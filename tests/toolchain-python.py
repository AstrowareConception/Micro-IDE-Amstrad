"""Regression for Windows launcher selection and shell-free spaced SDK paths."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from emcc_command import emcc_command


class LauncherTest(unittest.TestCase):
    def test_windows_launcher_with_spaces(self):
        with tempfile.TemporaryDirectory(prefix='CPC toolchain ') as directory:
            path = Path(directory) / 'emcc.py'
            path.write_text('import json, sys; print(json.dumps(sys.argv[1:]))', encoding='utf-8')
            for extension in ('.py', '.bat', '.cmd'):
                args = ['--version', 'argument with spaces', 'literal&value']
                command = emcc_command(str(path.with_suffix(extension)))
                output = subprocess.check_output([*command, *args], text=True)
                self.assertEqual(json.loads(output), args)

    def test_missing_python_launcher(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(SystemExit, 'Lanceur Emscripten Python absent'):
                emcc_command(str(Path(directory) / 'emcc.bat'))


if __name__ == '__main__':
    unittest.main()
