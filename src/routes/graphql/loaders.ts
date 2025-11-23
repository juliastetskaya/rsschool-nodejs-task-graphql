import DataLoader from 'dataloader';
import type { PrismaClient, MemberType, Post, Profile, User } from '@prisma/client';

export function createLoaders(prisma: PrismaClient) {
  const memberTypeLoader = new DataLoader<string, unknown>(async (ids) => {
    const memberTypes = await prisma.memberType.findMany({
      where: { id: { in: [...ids] } },
    });

    const memberTypeMap = new Map<string, MemberType>(
      memberTypes.map((mt) => [mt.id, mt]),
    );

    return ids.map((id) => memberTypeMap.get(id) || null);
  });

  const postsLoader = new DataLoader<string, unknown>(async (authorIds) => {
    const posts = await prisma.post.findMany({
      where: { authorId: { in: [...authorIds] } },
    });

    const postsByAuthor = new Map<string, Post[]>();
    authorIds.forEach((id) => postsByAuthor.set(id, []));
    posts.forEach((post) => {
      const authorPosts = postsByAuthor.get(post.authorId);
      if (authorPosts) {
        authorPosts.push(post);
      }
    });

    return authorIds.map((id) => postsByAuthor.get(id) || []);
  });

  const userLoader = new DataLoader<string, unknown>(async (ids) => {
    const users = await prisma.user.findMany({
      where: { id: { in: [...ids] } },
    });

    const userMap = new Map<string, User>(users.map((user) => [user.id, user]));

    return ids.map((id) => userMap.get(id) || null);
  });

  const postLoader = new DataLoader<string, unknown>(async (ids) => {
    const posts = await prisma.post.findMany({
      where: { id: { in: [...ids] } },
    });

    const postMap = new Map<string, Post>(posts.map((post) => [post.id, post]));

    return ids.map((id) => postMap.get(id) || null);
  });

  const profileLoader = new DataLoader<string, unknown>(async (userIds) => {
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: [...userIds] } },
    });
    const profileMap = new Map<string, Profile>(
      profiles.map((profile) => [profile.userId, profile]),
    );

    return userIds.map((userId) => profileMap.get(userId) || null);
  });

  const userSubscribedToLoader = new DataLoader<string, unknown[]>(
    async (subscriberIds) => {
      const subs = await prisma.subscribersOnAuthors.findMany({
        where: {
          subscriberId: { in: [...subscriberIds] },
        },
        include: {
          author: true,
        },
      });

      const subscriptionMap = new Map<string, User[]>();
      subscriberIds.forEach((id) => subscriptionMap.set(id, []));

      subs.forEach((sub) => {
        const authors = subscriptionMap.get(sub.subscriberId);
        if (authors) {
          authors.push(sub.author);
          userLoader.prime(sub.author.id, sub.author);
        }
      });

      return subscriberIds.map((id) => subscriptionMap.get(id) || []);
    },
  );

  const subscribedToUserLoader = new DataLoader<string, any[]>(async (authorIds) => {
    const subs = await prisma.subscribersOnAuthors.findMany({
      where: {
        authorId: { in: [...authorIds] },
      },
      include: {
        subscriber: true,
      },
    });

    const subscriberMap = new Map<string, User[]>();
    authorIds.forEach((id) => subscriberMap.set(id, []));

    subs.forEach((sub) => {
      const subscribers = subscriberMap.get(sub.authorId);
      if (subscribers) {
        subscribers.push(sub.subscriber);
        userLoader.prime(sub.subscriber.id, sub.subscriber);
      }
    });

    return authorIds.map((id) => subscriberMap.get(id) || []);
  });

  return {
    memberTypeLoader,
    postsLoader,
    postLoader,
    profileLoader,
    userLoader,
    userSubscribedToLoader,
    subscribedToUserLoader,
  };
}
