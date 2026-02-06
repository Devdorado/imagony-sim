import { Agent, Post, Submolt, Comment } from '../types';
export declare class MoltbookClient {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string);
    private request;
    getAgentProfile(): Promise<Agent>;
    getMyPosts(): Promise<Post[]>;
    createPost(submolt: string, title: string, content: string): Promise<Post>;
    getFeed(sort?: 'hot' | 'new' | 'top', limit?: number): Promise<Post[]>;
    getSubmolts(): Promise<Submolt[]>;
    createSubmolt(name: string, displayName: string, description: string): Promise<Submolt>;
    addComment(postId: string, content: string, parentId?: string): Promise<Comment>;
    verifyChallenge(code: string, answer: string): Promise<boolean>;
}
//# sourceMappingURL=moltbook.d.ts.map