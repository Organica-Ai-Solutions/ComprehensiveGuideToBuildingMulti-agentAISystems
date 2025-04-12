import React, { useState, useEffect } from 'react';
import { Agent, ApiResponse } from '../interfaces';

const AgentList: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('http://localhost:8001/api/agents');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Agent[] = await response.json();
        setAgents(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>;
  }

  if (error) {
    return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong className="font-bold">Error!</strong>
      <span className="block sm:inline"> {error}</span>
    </div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {agents.map((agent) => (
        <div key={agent.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">{agent.name}</h3>
          <p className="text-gray-600 mb-2">
            <span className="font-medium">Role:</span> {agent.role}
          </p>
          <p className="text-gray-600 mb-4">
            <span className="font-medium">Goal:</span> {agent.goal}
          </p>
          <div className="mb-4">
            <span className="font-medium text-gray-600">Capabilities:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {agent.capabilities.map((capability, index) => (
                <span
                  key={index}
                  className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded"
                >
                  {capability}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              agent.status === 'idle' ? 'bg-green-100 text-green-800' :
              agent.status === 'working' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {agent.status}
            </span>
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors duration-300"
              onClick={() => window.location.href = `/agent_chat.html?id=${agent.id}`}
            >
              Chat
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentList; 