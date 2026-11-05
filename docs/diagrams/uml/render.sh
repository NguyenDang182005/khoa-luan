#!/usr/bin/env bash
# Render toàn bộ sơ đồ UML (PlantUML) ra docs/diagrams/*.png và *.svg
# Chạy: bash docs/diagrams/uml/render.sh [file.puml ...]
set -e
cd "$(dirname "$0")"
JAR=../../../tools/plantuml.jar
files=("$@")
[ ${#files[@]} -eq 0 ] && files=(H*.puml)
java -jar "$JAR" -charset UTF-8 -tpng -Sdpi=180 -o .. "${files[@]}"
java -jar "$JAR" -charset UTF-8 -tsvg -o .. "${files[@]}"
