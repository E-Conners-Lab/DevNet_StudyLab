FROM python:3.12-slim

WORKDIR /app

# Install from the fully resolved lock file so a rebuild months from now gets
# the same tree. requirements.txt is the human-editable direct-dependency list.
COPY requirements.txt requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt

COPY . .

EXPOSE 8100

# The image has no curl (python:*-slim ships without it), so the health probe
# uses the interpreter that is guaranteed to be present. PORT lets the mock-*
# services reuse this probe on their own ports; the default keeps it working if
# PORT is unset or empty rather than silently probing port 80.
# urlopen raises on any non-2xx, so a bad status fails the probe without an
# explicit status comparison. Every failure mode exits non-zero (fails closed).
ENV PORT=8100
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+(os.environ.get('PORT') or '8100')+'/health', timeout=4)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
