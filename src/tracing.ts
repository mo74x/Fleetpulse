/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

function getExporter() {
  const exporterType = (
    process.env.OTEL_EXPORTER_TYPE || 'jaeger'
  ).toLowerCase();

  switch (exporterType) {
    case 'zipkin':
      return new ZipkinExporter({
        url:
          process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT ||
          'http://localhost:9411/api/v2/spans',
      });
    case 'otlp':
      return new OTLPTraceExporter({
        url:
          process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
          'http://localhost:4318/v1/traces',
      });
    case 'jaeger':
    default:
      return new JaegerExporter({
        endpoint:
          process.env.OTEL_EXPORTER_JAEGER_ENDPOINT ||
          'http://localhost:14268/api/traces',
      });
  }
}

const serviceName = process.env.OTEL_SERVICE_NAME || 'fleetpulse-service';

export const otelSDK = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  }),
  traceExporter: getExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

// Start tracing SDK before NestJS initializes
otelSDK.start();
console.log(
  `[OpenTelemetry] Distributed Tracing initialized for service: ${serviceName}`,
);

process.on('SIGTERM', () => {
  otelSDK
    .shutdown()
    .then(() => console.log('[OpenTelemetry] SDK terminated successfully'))
    .catch((error) =>
      console.error('[OpenTelemetry] Error terminating SDK', error),
    );
});
