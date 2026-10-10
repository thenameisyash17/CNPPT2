@echo off
echo Starting TCP and UDP Presentation Website...
echo Opening in default browser at http://localhost:8000
start http://localhost:8000
python -m http.server 8000
