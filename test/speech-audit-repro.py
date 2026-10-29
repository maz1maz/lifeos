"""Execute only fmt_ts from its AST; no server/model imports or audio files."""
import ast
from pathlib import Path

source = ast.parse(Path("speech-studio/server/app.py").read_text(encoding="utf-8"))
function = next(node for node in source.body if isinstance(node, ast.FunctionDef) and node.name == "fmt_ts")
scope = {}
exec(compile(ast.Module(body=[function], type_ignores=[]), "speech fmt_ts", "exec"), scope)
format_time = scope["fmt_ts"]
assert format_time(1.5, True) == "00:00:01,500"
print("CONTROL: ordinary SRT timestamp formats correctly")
assert format_time(1.9996, True) == "00:00:01,1000"
print("BUG: millisecond rounding emits invalid SRT timestamp 00:00:01,1000")
