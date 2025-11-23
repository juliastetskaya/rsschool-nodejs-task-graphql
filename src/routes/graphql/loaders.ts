import DataLoader from 'dataloader';
import type { PrismaClient, MemberType, Post } from '@prisma/client';

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

  return {
    memberTypeLoader,
    postsLoader,
  };
}
