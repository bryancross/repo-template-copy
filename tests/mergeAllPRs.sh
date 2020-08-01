#!/usr/bin/env bash
PAT="${1}"
echo "PAT: " $1
filename='PRData.txt'
while read -r line || [[ -n "$line" ]]
do
    bash -x ./mergePR.sh $line $PAT
    sleep 2
done < "$filename"
