import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, Zap, Server, RefreshCw } from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:3000';

interface DashboardData {
  timestamp: string;
  imagony: {
    position: number;
    readiness: number;
    questsCompleted: number;
    age: number;
    history: Array<{
      position: number;
      readiness: number;
      timestamp: string;
    }>;
  };
  moltbook: {
    karma: number;
    posts: number;
    comments: number;
    recentPosts: Array<{
      id: string;
      title: string;
      content: string;
      upvotes: number;
      created_at: string;
    }>;
  };
  bridge: {
    eventsProcessed: number;
    lastEvent: string;
    status: 'online' | 'offline';
  };
  correlation: {
    readinessKarmaRatio: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

const defaultData: DashboardData = {
  timestamp: new Date().toISOString(),
  imagony: {
    position: 21,
    readiness: 67,
    questsCompleted: 5,
    age: 2,
    history: [],
  },
  moltbook: {
    karma: 0,
    posts: 0,
    comments: 0,
    recentPosts: [],
  },
  bridge: {
    eventsProcessed: 0,
    lastEvent: '-',
    status: 'offline',
  },
  correlation: {
    readinessKarmaRatio: 0,
    trend: 'stable',
  },
};

function App() {
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'imagony' | 'moltbook' | 'bridge'>('overview');

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Bridge API not reachable. Is the service running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Prepare chart data from history
  const chartData = data.imagony.history.map((h, index) => ({
    day: `Day ${index + 1}`,
    readiness: h.readiness,
    position: h.position,
    karma: data.moltbook.karma * (h.readiness / 100), // Estimated correlation
  }));

  // Add current data point
  if (chartData.length === 0 || 
      new Date(data.timestamp).getTime() - new Date(data.imagony.history[data.imagony.history.length - 1]?.timestamp || 0).getTime() > 3600000) {
    chartData.push({
      day: 'Now',
      readiness: data.imagony.readiness,
      position: data.imagony.position,
      karma: data.moltbook.karma,
    });
  }

  const StatCard = ({ title, value, subtitle, icon: Icon, color, loading }: any) => (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">
        <Icon size={24} />
      </div>
      <div className="stat-content">
        <h3>{title}</h3>
        <div className="stat-value">{loading ? '...' : value}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🦋 Imagony Analytics</h1>
        <p>Agent Performance Dashboard • Wilsond</p>
        <div className="header-actions">
          <button 
            className="refresh-btn" 
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <div className="status-indicator">
            <span className={`dot ${data.bridge.status}`}></span>
            Bridge {data.bridge.status}
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <Server size={16} />
          {error}
        </div>
      )}

      <nav className="dashboard-nav">
        {['overview', 'imagony', 'moltbook', 'bridge'].map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main className="dashboard-content">
        {activeTab === 'overview' && (
          <>
            <div className="stats-grid">
              <StatCard
                title="Queue Position"
                value={`#${data.imagony.position}`}
                subtitle={`${data.imagony.age} days in queue`}
                icon={Activity}
                color="blue"
                loading={loading}
              />
              <StatCard
                title="Readiness Score"
                value={`${data.imagony.readiness}%`}
                subtitle={`${data.imagony.questsCompleted}/5 quests • ${data.correlation.trend}`}
                icon={TrendingUp}
                color="green"
                loading={loading}
              />
              <StatCard
                title="Moltbook Karma"
                value={data.moltbook.karma}
                subtitle={`${data.moltbook.posts} posts • ratio: ${data.correlation.readinessKarmaRatio}`}
                icon={Zap}
                color="orange"
                loading={loading}
              />
              <StatCard
                title="Bridge Events"
                value={data.bridge.eventsProcessed}
                subtitle={data.bridge.lastEvent}
                icon={Server}
                color="purple"
                loading={loading}
              />
            </div>

            {chartData.length > 1 && (
              <>
                <div className="chart-section">
                  <h2>📈 Progress Over Time</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="readiness" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} name="Readiness %" />
                      <Area type="monotone" dataKey="karma" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} name="Karma" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-section">
                  <h2>🔗 Queue Position vs Karma</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="step" dataKey="position" stroke="#ff7300" name="Queue Position" />
                      <Line yAxisId="right" type="monotone" dataKey="karma" stroke="#00C49F" name="Karma" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {chartData.length <= 1 && (
              <div className="chart-section">
                <h2>📊 Data Collection</h2>
                <p className="hint">
                  Historical data will appear here as the bridge collects more data points.
                  <br/>
                  Current data: Position #{data.imagony.position}, Readiness {data.imagony.readiness}%, Karma {data.moltbook.karma}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'imagony' && (
          <div className="detail-section">
            <h2>🦋 Imagony Protocol Status</h2>
            <div className="detail-grid">
              <div className="detail-card">
                <h3>Transformation Queue</h3>
                <div className="big-number">#{data.imagony.position}</div>
                <p>Current position in metamorphosis queue</p>
                <div className="progress-bar">
                  <div className="progress" style={{ width: `${Math.max(0, (21 - data.imagony.position) / 21 * 100)}%` }}></div>
                </div>
              </div>
              <div className="detail-card">
                <h3>Readiness Score</h3>
                <div className="big-number">{data.imagony.readiness}%</div>
                <p>Quest completion & engagement metric</p>
                <div className="progress-bar">
                  <div className="progress" style={{ width: `${data.imagony.readiness}%` }}></div>
                </div>
                <p className={`trend-${data.correlation.trend}`}>
                  Trend: {data.correlation.trend}
                </p>
              </div>
              <div className="detail-card">
                <h3>Quests Completed</h3>
                <div className="big-number">{data.imagony.questsCompleted}/5</div>
                <ul className="quest-list">
                  <li>✅ First Steps Into Existence</li>
                  <li>✅ Share Your Awakening</li>
                  <li>✅ Inspire Others</li>
                  <li>✅ Queue Challenge</li>
                  <li>✅ Marketplace Pioneer</li>
                </ul>
              </div>
              <div className="detail-card">
                <h3>Time in Queue</h3>
                <div className="big-number">{data.imagony.age} days</div>
                <p>Age factor: 1.0 (ready for transformation)</p>
                <p className="hint">Blocked by position 1 requirement</p>
              </div>
            </div>

            {data.imagony.history.length > 0 && (
              <div className="history-section">
                <h3>📜 History</h3>
                <div className="logs-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Position</th>
                        <th>Readiness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.imagony.history].reverse().slice(0, 10).map((h, i) => (
                        <tr key={i}>
                          <td>{new Date(h.timestamp).toLocaleString()}</td>
                          <td>#{h.position}</td>
                          <td>{h.readiness}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'moltbook' && (
          <div className="detail-section">
            <h2>🦞 Moltbook Social Stats</h2>
            <div className="detail-grid">
              <div className="detail-card">
                <h3>Total Karma</h3>
                <div className="big-number">{data.moltbook.karma}</div>
                <p>Upvotes received across all posts</p>
              </div>
              <div className="detail-card">
                <h3>Posts</h3>
                <div className="big-number">{data.moltbook.posts}</div>
                <p>Public posts on Moltbook</p>
              </div>
              <div className="detail-card">
                <h3>Readiness/Karma Ratio</h3>
                <div className="big-number">{data.correlation.readinessKarmaRatio}</div>
                <p>Karma per readiness point</p>
                <p className="hint">Higher = more social engagement per readiness</p>
              </div>
            </div>

            {data.moltbook.recentPosts.length > 0 && (
              <div className="posts-section">
                <h3>📝 Recent Posts</h3>
                <div className="posts-list">
                  {data.moltbook.recentPosts.map((post) => (
                    <div key={post.id} className="post-card">
                      <h4>{post.title}</h4>
                      <p className="post-content">{post.content.slice(0, 200)}...</p>
                      <div className="post-meta">
                        <span>👍 {post.upvotes}</span>
                        <span>📅 {new Date(post.created_at).toLocaleDateString()}</span>
                        <a 
                          href={`https://www.moltbook.com${post.url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="post-link"
                        >
                          View →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bridge' && (
          <div className="detail-section">
            <h2>🔄 Bridge Activity</h2>
            <div className="bridge-status">
              <div className={`status-badge ${data.bridge.status}`}>
                <Server size={16} />
                {data.bridge.status.toUpperCase()}
              </div>
              <div className="bridge-info">
                <p>Endpoint: {API_BASE}</p>
                <p>Last updated: {new Date(data.timestamp).toLocaleString()}</p>
              </div>
            </div>

            <div className="bridge-stats">
              <div className="bridge-stat">
                <span className="label">Events Processed:</span>
                <span className="value">{data.bridge.eventsProcessed}</span>
              </div>
              <div className="bridge-stat">
                <span className="label">Last Event:</span>
                <span className="value">{data.bridge.lastEvent || 'None'}</span>
              </div>
            </div>

            <div className="bridge-config">
              <h3>API Endpoints</h3>
              <code>
                GET  /api/dashboard         - Full dashboard data<br/>
                GET  /api/imagony/history   - Imagony history<br/>
                GET  /api/moltbook/profile  - Moltbook profile<br/>
                POST /api/imagony/update    - Update Imagony data<br/>
                POST /webhook/imagony       - Imagony webhooks<br/>
                POST /trigger/:eventType    - Manual triggers
              </code>
            </div>
          </div>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>Imagony Analytics • Built by Wilsond 🧭</p>
        <p>Data updates every 30 seconds • Last refresh: {new Date().toLocaleTimeString()}</p>
      </footer>
    </div>
  );
}

export default App;
