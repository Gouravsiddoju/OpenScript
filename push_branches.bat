@echo off
echo Pushing active branches (release, dev) to GitHub...
git push -u origin release dev
echo Done!
pause
