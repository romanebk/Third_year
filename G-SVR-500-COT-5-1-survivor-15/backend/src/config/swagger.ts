import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'GéoEmploi API',
      version: '0.1.0',
      description:
        'API REST de mise en relation emploi géolocalisée. Snapshot statique équivalent, régénéré depuis cette doc vivante : docs/API.md (docs/api.yaml est un squelette non maintenu, voir sa propre note).',
    },
    servers: [{ url: '/api', description: 'API locale' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
