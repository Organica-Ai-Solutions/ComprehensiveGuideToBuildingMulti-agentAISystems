"""
Web Search Tool for Multi-Agent AI System

This module provides a simulated web search functionality for the agents.
In a production system, this would be connected to a real search API.
"""

import json
import random
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample search results database
SEARCH_RESULTS = {
    "ai": [
        {
            "title": "Artificial Intelligence - Wikipedia",
            "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
            "snippet": "Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans."
        },
        {
            "title": "What is AI (Artificial Intelligence)? | IBM",
            "url": "https://www.ibm.com/cloud/learn/what-is-artificial-intelligence",
            "snippet": "Artificial intelligence (AI) leverages computers and machines to mimic the problem-solving and decision-making capabilities of the human mind."
        }
    ],
    "python": [
        {
            "title": "Python (programming language) - Wikipedia",
            "url": "https://en.wikipedia.org/wiki/Python_(programming_language)",
            "snippet": "Python is a high-level, general-purpose programming language. Its design philosophy emphasizes code readability with the use of significant indentation."
        },
        {
            "title": "Python.org",
            "url": "https://www.python.org/",
            "snippet": "The official home of the Python Programming Language. Python is a programming language that lets you work quickly and integrate systems more effectively."
        }
    ],
    "machine learning": [
        {
            "title": "Machine learning - Wikipedia",
            "url": "https://en.wikipedia.org/wiki/Machine_learning",
            "snippet": "Machine learning (ML) is a field of inquiry devoted to understanding and building methods that 'learn', that is, methods that leverage data to improve performance on some set of tasks."
        },
        {
            "title": "What is Machine Learning? | IBM",
            "url": "https://www.ibm.com/cloud/learn/machine-learning",
            "snippet": "Machine learning is a branch of artificial intelligence (AI) and computer science which focuses on the use of data and algorithms to imitate the way that humans learn, gradually improving its accuracy."
        }
    ],
    "multi agent system": [
        {
            "title": "Multi-agent system - Wikipedia",
            "url": "https://en.wikipedia.org/wiki/Multi-agent_system",
            "snippet": "A multi-agent system (MAS) is a computerized system composed of multiple interacting intelligent agents. Multi-agent systems can solve problems that are difficult or impossible for an individual agent."
        },
        {
            "title": "Multi-Agent Systems: A survey | ScienceDirect",
            "url": "https://www.sciencedirect.com/science/article/pii/S0952197619300429",
            "snippet": "Multi-agent systems are systems composed of multiple interacting computing elements, known as agents. Multi-agent systems can be used to solve problems that are difficult or impossible for an individual agent or a monolithic system to solve."
        }
    ],
    "natural language processing": [
        {
            "title": "Natural language processing - Wikipedia",
            "url": "https://en.wikipedia.org/wiki/Natural_language_processing",
            "snippet": "Natural language processing (NLP) is a subfield of linguistics, computer science, and artificial intelligence concerned with the interactions between computers and human language."
        },
        {
            "title": "What is Natural Language Processing? | IBM",
            "url": "https://www.ibm.com/cloud/learn/natural-language-processing",
            "snippet": "Natural language processing (NLP) refers to the branch of computer science—and more specifically, the branch of artificial intelligence or AI—concerned with giving computers the ability to understand text and spoken words in much the same way human beings can."
        }
    ]
}

def search(query: str, num_results: int = 3) -> Dict[str, Any]:
    """
    Simulated web search function
    
    Args:
        query: The search query string
        num_results: Maximum number of results to return
        
    Returns:
        Dictionary containing search results and metadata
    """
    logger.info(f"Executing web search for: {query}")
    
    # Convert query to lowercase for matching
    query_lower = query.lower()
    
    # Find matching results
    results = []
    
    # Check for exact matches first
    if query_lower in SEARCH_RESULTS:
        results.extend(SEARCH_RESULTS[query_lower])
    
    # If not enough results, look for partial matches
    if len(results) < num_results:
        for key, data in SEARCH_RESULTS.items():
            if key != query_lower and key in query_lower:
                for item in data:
                    if item not in results:
                        results.append(item)
                        if len(results) >= num_results:
                            break
    
    # If still not enough results, add random results
    if len(results) < num_results:
        all_results = []
        for data in SEARCH_RESULTS.values():
            all_results.extend(data)
        
        # Shuffle and add random results
        random.shuffle(all_results)
        for item in all_results:
            if item not in results:
                results.append(item)
                if len(results) >= num_results:
                    break
    
    # Limit results to requested number
    results = results[:num_results]
    
    return {
        "query": query,
        "results": results,
        "total_found": len(results),
        "timestamp": datetime.now().isoformat(),
        "source": "simulated-web-search"
    }

async def process_web_search(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a web search request and return results
    
    Args:
        request_data: Dictionary containing the search request parameters
        
    Returns:
        Dictionary containing the search results
    """
    query = request_data.get("query", "")
    if not query:
        return {
            "error": "No query provided",
            "status": "error"
        }
    
    try:
        # Extract parameters
        num_results = int(request_data.get("num_results", 3))
        
        # Perform search
        results = search(query, num_results)
        
        # Format results for display
        formatted_results = []
        for idx, result in enumerate(results["results"]):
            formatted_results.append(f"{idx+1}. {result['title']}\n   {result['url']}\n   {result['snippet']}")
        
        result_text = "\n\n".join(formatted_results)
        
        return {
            "status": "success",
            "query": query,
            "num_results": len(results["results"]),
            "results": results["results"],
            "result_text": result_text,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error processing web search: {str(e)}")
        return {
            "error": f"Error processing search: {str(e)}",
            "status": "error"
        }

# For testing
if __name__ == "__main__":
    import asyncio
    
    async def test():
        test_query = "How do multi agent systems work?"
        result = await process_web_search({"query": test_query})
        print(json.dumps(result, indent=2))
        
    asyncio.run(test()) 