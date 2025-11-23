import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLSchema,
  GraphQLEnumType,
  GraphQLList,
  GraphQLBoolean,
  GraphQLInputObjectType,
} from 'graphql';
import type { PrismaClient, Profile, User, SubscribersOnAuthors } from '@prisma/client';
import { parseResolveInfo, type ResolveTree } from 'graphql-parse-resolve-info';
import type DataLoader from 'dataloader';
import { UUIDType } from './types/uuid.js';

type UserWithRelations = User & {
  userSubscribedTo?: SubscribersOnAuthors[];
  subscribedToUser?: SubscribersOnAuthors[];
};

export interface Context {
  prisma: PrismaClient;
  loaders: {
    postLoader: DataLoader<string, unknown>;
    postsLoader: DataLoader<string, unknown>;
    memberTypeLoader: DataLoader<string, unknown>;
    profileLoader: DataLoader<string, unknown>;
    userLoader: DataLoader<string, unknown>;
    userSubscribedToLoader: DataLoader<string, unknown>;
    subscribedToUserLoader: DataLoader<string, unknown>;
  };
}

export const MemberTypeIdEnum = new GraphQLEnumType({
  name: 'MemberTypeId',
  values: {
    BASIC: { value: 'BASIC' },
    BUSINESS: { value: 'BUSINESS' },
  },
});

export const MemberTypeType: GraphQLObjectType = new GraphQLObjectType({
  name: 'MemberType',
  fields: () => ({
    id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
    discount: { type: new GraphQLNonNull(GraphQLFloat) },
    postsLimitPerMonth: { type: new GraphQLNonNull(GraphQLInt) },
  }),
});

export const PostType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
  }),
});

export const ProfileType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Profile',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    memberType: {
      type: new GraphQLNonNull(MemberTypeType),
      resolve: async (parent: Profile, _args, context: Context) => {
        const { loaders } = context;

        return loaders.memberTypeLoader.load(parent.memberTypeId);
      },
    },
  }),
});

export const UserType: GraphQLObjectType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
    profile: {
      type: ProfileType,
      resolve: async (parent, _args, context: Context) => {
        const { loaders } = context;

        return loaders.profileLoader.load(parent.id);
      },
    },
    posts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostType))),
      resolve: async (parent, _args, context: Context) => {
        const { loaders } = context;

        return loaders.postsLoader.load(parent.id);
      },
    },
    userSubscribedTo: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (parent, _args, context: Context) => {
        const { loaders } = context;

        return loaders.userSubscribedToLoader.load(parent.id);
      },
    },
    subscribedToUser: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (parent, _args, context: Context) => {
        const { loaders } = context;

        return loaders.subscribedToUserLoader.load(parent.id);
      },
    },
  }),
});

export const RootQueryType = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    memberTypes: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(MemberTypeType))),
      resolve: async (_parent, _args, context: Context) => {
        const { prisma } = context;

        return prisma.memberType.findMany();
      },
    },
    memberType: {
      type: MemberTypeType,
      args: {
        id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
      },
      resolve: async (_parent, args, context: Context) => {
        const { prisma } = context;

        return prisma.memberType.findUnique({ where: { id: args.id } });
      },
    },
    post: {
      type: PostType,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_parent, args, context: Context) => {
        const { loaders } = context;

        return loaders.postLoader.load(args.id);
      },
    },
    posts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostType))),
      resolve: async (_parent, _args, context: Context) => {
        const { prisma } = context;

        return prisma.post.findMany();
      },
    },
    profiles: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ProfileType))),
      resolve: async (_parent, _args, context: Context) => {
        const { prisma } = context;

        return prisma.profile.findMany();
      },
    },
    profile: {
      type: ProfileType,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_parent, args, context: Context) => {
        const { prisma } = context;

        return prisma.profile.findUnique({ where: { id: args.id } });
      },
    },
    users: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (_parent, _args, context: Context, info) => {
        const { prisma, loaders } = context;

        const parsedInfo = parseResolveInfo(info) as ResolveTree;

        const includeUserSubscribedTo = Boolean(
          parsedInfo?.fieldsByTypeName?.User?.userSubscribedTo,
        );
        const includeSubscribedToUser = Boolean(
          parsedInfo?.fieldsByTypeName?.User?.subscribedToUser,
        );

        const include = { userSubscribedTo: false, subscribedToUser: false };
        if (includeUserSubscribedTo) {
          include.userSubscribedTo = true;
        }
        if (includeSubscribedToUser) {
          include.subscribedToUser = true;
        }

        const users = (await prisma.user.findMany({
          include: Object.keys(include).length > 0 ? include : undefined,
        })) as UserWithRelations[];

        users.forEach((user) => {
          loaders.userLoader.prime(user.id, user);

          if (includeUserSubscribedTo && user.userSubscribedTo) {
            const subscribedUsers = user.userSubscribedTo.map((sub) => ({
              id: sub.authorId,
            }));
            loaders.userSubscribedToLoader.prime(user.id, subscribedUsers);
          }

          if (includeSubscribedToUser && user.subscribedToUser) {
            const subscribers = user.subscribedToUser.map((sub) => ({
              id: sub.subscriberId,
            }));
            loaders.subscribedToUserLoader.prime(user.id, subscribers);
          }
        });

        return users;
      },
    },
    user: {
      type: UserType,
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_parent, args, context: Context) => {
        const { loaders } = context;

        return loaders.userLoader.load(args.id);
      },
    },
  },
});

export const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

export const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  },
});

export const MutationsType = new GraphQLObjectType({
  name: 'Mutations',
  fields: {
    createUser: {
      type: new GraphQLNonNull(UserType),
      args: {
        dto: { type: new GraphQLNonNull(CreateUserInput) },
      },
      resolve: async (_parent, args, context: Context) => {
        const { prisma } = context;

        return prisma.user.create({ data: args.dto });
      },
    },
    changeUser: {
      type: new GraphQLNonNull(UserType),
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
        dto: { type: new GraphQLNonNull(ChangeUserInput) },
      },
      resolve: async (_parent, args, context: Context) => {
        const { prisma } = context;

        return prisma.user.update({
          where: { id: args.id },
          data: args.dto,
        });
      },
    },
    deleteUser: {
      type: new GraphQLNonNull(GraphQLString),
      args: {
        id: { type: new GraphQLNonNull(UUIDType) },
      },
      resolve: async (_parent, args, context: Context) => {
        const { prisma } = context;

        await prisma.user.delete({ where: { id: args.id } });

        return 'User deleted';
      },
    },
  },
});

export const schema = new GraphQLSchema({
  query: RootQueryType,
});
