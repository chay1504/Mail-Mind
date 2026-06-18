FROM n8nio/n8n:2.20.9

USER root
RUN mkdir -p /tmp/n8n-workflows && chown -R node:node /tmp/n8n-workflows
USER node

# Copy the workflow files into the container
COPY --chown=node:node n8n/mailmind-scheduled-sync.json /tmp/n8n-workflows/mailmind-scheduled-sync.json
COPY --chown=node:node n8n/mailmind-process-thread-webhook.json /tmp/n8n-workflows/mailmind-process-thread-webhook.json

# Expose default n8n port
EXPOSE 5678

# Bypass default entrypoint to avoid "sh not found" error in n8n's entrypoint script
ENTRYPOINT []

# Start n8n in the background, wait for startup, import workflows, and keep running
CMD ["/bin/sh", "-c", "n8n start & sleep 10; n8n import:workflow --input=/tmp/n8n-workflows/mailmind-scheduled-sync.json; n8n import:workflow --input=/tmp/n8n-workflows/mailmind-process-thread-webhook.json; wait"]
