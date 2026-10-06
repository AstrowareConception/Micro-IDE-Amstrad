"""Invoke Emscripten without a shell, including SDK paths with spaces on Windows."""
from pathlib import Path
import shutil
import sys


def emcc_command(compiler):
    path = Path(shutil.which(compiler) or compiler)
    if path.suffix.lower() in ('.bat', '.cmd'):
        path = path.with_suffix('.py')
    if path.suffix.lower() == '.py':
        if not path.is_file():
            raise SystemExit('Lanceur Emscripten Python absent : ' + str(path))
        return [sys.executable, str(path)]
    return [str(path)]
