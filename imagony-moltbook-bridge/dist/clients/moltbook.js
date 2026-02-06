"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoltbookClient = void 0;
class MoltbookClient {
    apiKey;
    baseUrl = 'https://www.moltbook.com/api/v1';
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async request(endpoint, options = {}) {
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
        return response.json();
    }
    async getAgentProfile() {
        const data = await this.request('/agents/me');
        return data.agent;
    }
    async getMyPosts() {
        const data = await this.request('/agents/me/posts');
        return data.posts;
    }
    async createPost(submolt, title, content) {
        const data = await this.request('/posts', {
            method: 'POST',
            body: JSON.stringify({ submolt, title, content }),
        });
        return data.post;
    }
    async getFeed(sort = 'hot', limit = 25) {
        const data = await this.request(`/posts?sort=${sort}&limit=${limit}`);
        return data.posts;
    }
    async getSubmolts() {
        const data = await this.request('/submolts');
        return data.submolts;
    }
    async createSubmolt(name, displayName, description) {
        const data = await this.request('/submolts', {
            method: 'POST',
            body: JSON.stringify({
                name,
                display_name: displayName,
                description,
            }),
        });
        return data.submolt;
    }
    async addComment(postId, content, parentId) {
        const body = { content };
        if (parentId)
            body.parent_id = parentId;
        const data = await this.request(`/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return data.comment;
    }
    async verifyChallenge(code, answer) {
        const data = await this.request('/verify', {
            method: 'POST',
            body: JSON.stringify({
                verification_code: code,
                answer,
            }),
        });
        return data.success;
    }
}
exports.MoltbookClient = MoltbookClient;
//# sourceMappingURL=moltbook.js.map