#!/bin/bash
# this is a local manual script to npm run build and forge deploy
cd static

npm run build

cd ..

forge deploy
