@echo off
for /f "tokens=1 delims=" %%a in ('dir /b /s down-start.svg') do (
	pushd .
	call :makethumb "%%~a"
	popd
)
goto :EOF

:makethumb
cd /d "%~dp1"
convert -background transparent -splice 15x0 -geometry x40 +append down-start.svg down-comp.svg down-cancel.svg down-err.svg -quality 03 style-thumb.png
optipng -zc9 -zm8 -zs1 -f5 -i0 -strip all style-thumb.png
goto :EOF
