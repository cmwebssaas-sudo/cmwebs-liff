import io
import json
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

import cmwebs_assistant_bridge as bridge

CATALOG = [
    {'id': 'checkout', 'title': '房客退房、退租', 'keywords': ['退房', '搬走']},
    {'id': 'renewal', 'title': '續約', 'keywords': ['續約']},
]


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def fake_model(content):
    calls = []

    def opener(request, timeout):
        calls.append(json.loads(request.data.decode('utf-8')))
        return FakeResponse(json.dumps({'message': {'content': content}}).encode('utf-8'))

    opener.calls = calls
    return opener


class BridgeTest(unittest.TestCase):
    def serve(self, opener, token='secret-token'):
        config = {'token': token, 'port': 0, 'model_url': 'http://model', 'model': 'm', 'timeout': 5}
        server = ThreadingHTTPServer(('127.0.0.1', 0), bridge.make_handler(config, opener))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.shutdown)
        return 'http://127.0.0.1:%d' % server.server_address[1]

    def post(self, base, body, token='secret-token'):
        request = urllib.request.Request(base + '/v1/answer', data=json.dumps(body).encode('utf-8'), method='POST',
                                         headers={'content-type': 'application/json', 'authorization': 'Bearer ' + token})
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_answers_with_a_catalog_function(self):
        opener = fake_model('{"id":"checkout","reply":"退房請到房客資料按辦理退房。"}')
        status, body = self.post(self.serve(opener), {'question': '房客要搬走', 'catalog': CATALOG})
        self.assertEqual(status, 200)
        self.assertEqual(body['data'], {'id': 'checkout', 'reply': '退房請到房客資料按辦理退房。'})
        sent = opener.calls[0]
        self.assertEqual(sent['format'], 'json')
        self.assertIn('checkout｜房客退房、退租｜退房、搬走', sent['messages'][0]['content'])
        self.assertEqual(sent['messages'][1], {'role': 'user', 'content': '房客要搬走'})

    def test_invented_function_becomes_none(self):
        status, body = self.post(self.serve(fake_model('{"id":"delete_everything","reply":"x"}')),
                                 {'question': '刪掉全部', 'catalog': CATALOG})
        self.assertEqual(status, 200)
        self.assertEqual(body['data']['id'], 'none')

    def test_wrong_token_is_refused_before_the_model(self):
        opener = fake_model('{"id":"checkout","reply":""}')
        status, body = self.post(self.serve(opener), {'question': '退房', 'catalog': CATALOG}, token='wrong')
        self.assertEqual((status, body['code']), (401, 'UNAUTHORIZED'))
        self.assertEqual(opener.calls, [])

    def test_bad_requests_are_refused(self):
        base = self.serve(fake_model('{}'))
        self.assertEqual(self.post(base, {'question': '', 'catalog': CATALOG})[1]['code'], 'INVALID_QUESTION')
        self.assertEqual(self.post(base, {'question': '退' * 201, 'catalog': CATALOG})[1]['code'], 'INVALID_QUESTION')
        self.assertEqual(self.post(base, {'question': '退房', 'catalog': []})[1]['code'], 'INVALID_CATALOG')

    def test_model_failure_is_reported_without_details(self):
        def broken(request, timeout):
            raise OSError('connection refused to the model host')
        status, body = self.post(self.serve(broken), {'question': '退房', 'catalog': CATALOG})
        self.assertEqual((status, body), (504, {'success': False, 'code': 'MODEL_UNAVAILABLE'}))

    def test_invalid_model_output(self):
        status, body = self.post(self.serve(fake_model('not json')), {'question': '退房', 'catalog': CATALOG})
        self.assertEqual((status, body['code']), (502, 'MODEL_INVALID_OUTPUT'))


if __name__ == '__main__':
    unittest.main()
