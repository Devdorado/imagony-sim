import { Agent, Post, Submolt, Comment } from '../types';

export class MoltbookClient {
  private apiKey: string;
  private baseUrl = 'https://www.moltbook.com/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Moltbook API error: ${response.status} ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getAgentProfile(): Promise<Agent> {
    const data = await this.request<{ agent: Agent }>('/agents/me');
    return data.agent;
  }

  async createPost(submolt: string, title: string, content: string): Promise<Post> {
    const data = await this.request<{ post: Post }>('/posts', {
      method: 'POST',
      body: JSON.stringify({ submolt, title, content }),
    });
    return data.post;
  }

  async getFeed(sort: 'hot' | 'new' | 'top' = 'hot', limit = 25): Promise<Post[]> {
    const data = await this.request<{ posts: Post[] }>(`/posts?sort=${sort}&limit=${limit}`);
    return data.posts;
  }

  async getSubmolts(): Promise<Submolt[]> {
    const data = await this.request<{ submolts: Submolt[] }>('/submolts');
    return data.submolts;
  }

  async createSubmolt(name: string, displayName: string, description: string): Promise<Submolt> {
    const data = await this.request<{ submolt: Submolt }>('/submolts', {
      method: 'POST',
      body: JSON.stringify({
        name,
        display_name: displayName,
        description,
      }),
    });
    return data.submolt;
  }

  async addComment(postId: string, content: string, parentId?: string): Promise<Comment> {
    const body: Record<string, string> = { content };
    if (parentId) body.parent_id = parentId;
    
    const data = await this.request<{ comment: Comment }>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return data.comment;
  }

  async verifyChallenge(code: string, answer: string): Promise<boolean> {
    const data = await this.request<{ success: boolean }>('/verify', {
      method: 'POST',
      body: JSON.stringify({
        verification_code: code,
        answer,
      }),
    });
    return data.success;
  }
}
