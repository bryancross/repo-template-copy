#!/usr/bin/env bash

PR_URL="${1}"
PAT="${2}"

curl -X PUT -H "Content-Type: application/json" -H "Authorization: token ${PAT}"  $PR_URL'/merge'