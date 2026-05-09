{{- define "agentsync.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "agentsync.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "agentsync.databaseUrl" -}}
{{- if .Values.secrets.databaseUrl -}}
{{ .Values.secrets.databaseUrl }}
{{- else -}}
postgresql://agentsync:agentsync@{{ include "agentsync.fullname" . }}-postgres:5432/agentsync
{{- end -}}
{{- end -}}

{{- define "agentsync.redisUrl" -}}
{{- if .Values.secrets.redisUrl -}}
{{ .Values.secrets.redisUrl }}
{{- else -}}
redis://{{ include "agentsync.fullname" . }}-redis:6379
{{- end -}}
{{- end -}}
