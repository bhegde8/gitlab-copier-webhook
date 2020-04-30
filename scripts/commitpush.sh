#!/bin/bash

#$1: dest_root/lang/
#$2: commit message
#$3: GitHub username
#$4: GitHub password
#$5: lang

cd $1

git config user.email "redacted@gmail.com"
git config user.name "redacted"

git add .
git commit -m $2
git push https://$3:$4@github.com/redacted/$5.git --all