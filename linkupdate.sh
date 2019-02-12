#!/bin/bash
curl "https://synch-api.herokuapp.com/add.json?url=$1&userlink=$(youtube-dl -f best -g "$1")"
