from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from .base import Agent
from tools.handlers import ToolRegistry
from safety.guardrails import SafetyGuardrails
from knowledge.base import KnowledgeBase

logger = logging.getLogger(__name__)

class CodeAgent(Agent):
    """Agent specialized for code generation and analysis."""
    
    def __init__(
        self,
        agent_id: str,
        name: str,
        tool_registry: ToolRegistry,
        guardrails: SafetyGuardrails,
        knowledge_base: KnowledgeBase,
        capabilities: List[str] = None
    ):
        super().__init__(
            agent_id=agent_id,
            name=name,
            role="code_assistant",
            goal="Generate and analyze code efficiently and safely",
            tool_registry=tool_registry,
            guardrails=guardrails,
            capabilities=capabilities or ["code_analysis", "code_generation", "testing"]
        )
        self._knowledge_base = knowledge_base
        
    async def _generate_response(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Generate code-related responses."""
        try:
            # Analyze request
            analysis = await self.use_tool("code_analysis", content=message["content"])
            
            # Get relevant knowledge
            context = await self._knowledge_base.query(
                query=message["content"],
                domain="programming",
                limit=5
            )
            
            # Generate code if needed
            if analysis.get("requires_code"):
                code = await self.use_tool(
                    "code_generation",
                    prompt=message["content"],
                    context=context
                )
                return {
                    "content": code["result"],
                    "reasoning": analysis["reasoning"],
                    "references": context["references"]
                }
            
            return {
                "content": analysis["explanation"],
                "reasoning": analysis["reasoning"],
                "references": context["references"]
            }
            
        except Exception as e:
            logger.error(f"Error generating code response: {str(e)}")
            return {
                "error": "Failed to generate code response",
                "details": str(e)
            }

class ResearchAgent(Agent):
    """Agent specialized for research and information gathering."""
    
    def __init__(
        self,
        agent_id: str,
        name: str,
        tool_registry: ToolRegistry,
        guardrails: SafetyGuardrails,
        knowledge_base: KnowledgeBase,
        capabilities: List[str] = None
    ):
        super().__init__(
            agent_id=agent_id,
            name=name,
            role="researcher",
            goal="Gather and synthesize information effectively",
            tool_registry=tool_registry,
            guardrails=guardrails,
            capabilities=capabilities or ["search", "summarize", "fact_check"]
        )
        self._knowledge_base = knowledge_base
        
    async def _generate_response(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Generate research-based responses."""
        try:
            # Search for information
            search_results = await self.use_tool(
                "search",
                query=message["content"],
                limit=10
            )
            
            # Fact check results
            verified_results = await self.use_tool(
                "fact_check",
                content=search_results["results"]
            )
            
            # Synthesize information
            summary = await self.use_tool(
                "summarize",
                content=verified_results["verified_content"]
            )
            
            # Update knowledge base
            await self._knowledge_base.add_entry(
                content=summary["result"],
                source_urls=search_results["sources"],
                confidence=verified_results["confidence"]
            )
            
            return {
                "content": summary["result"],
                "sources": search_results["sources"],
                "confidence": verified_results["confidence"]
            }
            
        except Exception as e:
            logger.error(f"Error generating research response: {str(e)}")
            return {
                "error": "Failed to generate research response",
                "details": str(e)
            }

class TaskAgent(Agent):
    """Agent specialized for task management and coordination."""
    
    def __init__(
        self,
        agent_id: str,
        name: str,
        tool_registry: ToolRegistry,
        guardrails: SafetyGuardrails,
        knowledge_base: KnowledgeBase,
        capabilities: List[str] = None
    ):
        super().__init__(
            agent_id=agent_id,
            name=name,
            role="task_manager",
            goal="Coordinate tasks and manage agent collaboration",
            tool_registry=tool_registry,
            guardrails=guardrails,
            capabilities=capabilities or ["task_planning", "agent_coordination", "progress_tracking"]
        )
        self._knowledge_base = knowledge_base
        self._active_tasks: Dict[str, Dict[str, Any]] = {}
        
    async def _generate_response(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Generate task management responses."""
        try:
            # Analyze task requirements
            task_analysis = await self.use_tool(
                "task_planning",
                content=message["content"]
            )
            
            # Create task plan
            task_plan = {
                "id": task_analysis["task_id"],
                "steps": task_analysis["steps"],
                "assigned_agents": task_analysis["required_agents"],
                "status": "planned",
                "progress": 0,
                "created_at": datetime.now().isoformat()
            }
            
            # Store task
            self._active_tasks[task_plan["id"]] = task_plan
            
            # Start task coordination
            coordination_result = await self.use_tool(
                "agent_coordination",
                task_plan=task_plan
            )
            
            return {
                "task_id": task_plan["id"],
                "plan": task_plan["steps"],
                "assigned_agents": coordination_result["assignments"],
                "estimated_completion": coordination_result["estimated_completion"]
            }
            
        except Exception as e:
            logger.error(f"Error generating task response: {str(e)}")
            return {
                "error": "Failed to generate task response",
                "details": str(e)
            }
    
    async def update_task_progress(self, task_id: str, progress: float) -> None:
        """Update task progress."""
        if task_id in self._active_tasks:
            self._active_tasks[task_id]["progress"] = progress
            if progress >= 1.0:
                self._active_tasks[task_id]["status"] = "completed"
            
            await self.use_tool(
                "progress_tracking",
                task_id=task_id,
                progress=progress
            ) 