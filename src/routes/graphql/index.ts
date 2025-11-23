import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { graphql, validate, parse } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { schema } from './schema.js';
import { createLoaders } from './loaders.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      const { query, variables } = req.body;

      const loaders = createLoaders(prisma);
      const document = parse(query);

      const validationErrors = validate(schema, document, [depthLimit(5)]);
      if (validationErrors.length > 0) {
        return {
          errors: validationErrors,
        };
      }

      return await graphql({
        schema,
        source: query,
        variableValues: variables,
        contextValue: {
          prisma,
          loaders,
        },
      });
    },
  });
};

export default plugin;
