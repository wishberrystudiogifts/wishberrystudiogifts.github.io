#!/bin/sh
# copy the built NYE product into the site working tree (no removals)
set -e
S=/home/claude/work/nye/prod/new-years-eve-invitation-1-2026-11-27
D=/home/claude/site/product/new-years-eve-invitation-1-2026-11-27
mkdir -p "$D"
cp -r "$S"/. "$D"/
ls "$D" "$D/assets" | wc -l
