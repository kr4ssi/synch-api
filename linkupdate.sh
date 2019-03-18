#!/bin/bash
curl "https://synchapi.herokuapp.com/add.json?url=$1&userlink=$(youtube-dl -f best -g "$1")"
