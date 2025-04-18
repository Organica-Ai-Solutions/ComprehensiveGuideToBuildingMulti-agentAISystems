"""
Text Processing Tool for Multi-Agent AI System

This module provides text processing capabilities including summarization,
sentiment analysis, and grammar checking.
"""

import json
import re
import random
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Common grammar issues and patterns
GRAMMAR_PATTERNS = {
    "double_negation": r"\b(?:not\s+.*\s+not|never\s+.*\s+not|not\s+.*\s+never)\b",
    "subject_verb_agreement": r"\b(?:they\s+is|he\s+are|she\s+are|it\s+are|i\s+is|we\s+is)\b",
    "run_on_sentence": r"[^.!?]{100,}[.!?]",
    "double_word": r"\b(\w+)\s+\1\b",
    "missing_apostrophe": r"\b(?:cant|wont|dont|didnt|havent|hasnt|wouldnt|shouldnt|couldnt|im|youre|theyre|weve|theyve)\b",
    "comma_splice": r"[^.!?]+,\s+[A-Z][^.!?]+[.!?]"
}

def analyze_grammar(text: str) -> Dict[str, Any]:
    """
    Analyze text for grammar issues
    
    Args:
        text: The text to analyze
        
    Returns:
        Dictionary containing grammar analysis results
    """
    logger.info("Analyzing grammar")
    
    issues = []
    
    # Find pattern matches
    for issue_type, pattern in GRAMMAR_PATTERNS.items():
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            # Find line number and position
            line_num = text[:match.start()].count('\n') + 1
            
            # Get some context around the match
            start_context = max(0, match.start() - 20)
            end_context = min(len(text), match.end() + 20)
            context = text[start_context:end_context]
            
            # Highlight the matching part
            if start_context < match.start() and match.end() < end_context:
                highlight_context = (
                    context[:match.start() - start_context] + 
                    "**" + context[match.start() - start_context:match.end() - start_context] + "**" + 
                    context[match.end() - start_context:]
                )
            else:
                highlight_context = context
            
            issues.append({
                "type": issue_type.replace("_", " "),
                "line": line_num,
                "match": match.group(0),
                "context": highlight_context,
                "message": f"Potential {issue_type.replace('_', ' ')} issue"
            })
    
    # Count words
    word_count = len(re.findall(r'\b\w+\b', text))
    
    # Count sentences
    sentence_count = len(re.findall(r'[.!?]+', text))
    
    # Assess readability (simplified Flesch-Kincaid)
    avg_sentence_length = word_count / max(1, sentence_count)
    readability_score = max(0, min(100, 100 - (avg_sentence_length - 10) * 5))
    
    # Assess readability level
    readability_level = "College"
    if readability_score > 80:
        readability_level = "Elementary"
    elif readability_score > 70:
        readability_level = "Middle School"
    elif readability_score > 60:
        readability_level = "High School"
    elif readability_score > 50:
        readability_level = "College"
    else:
        readability_level = "Graduate"
    
    return {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "issues": issues,
        "issue_count": len(issues),
        "readability_score": round(readability_score, 1),
        "readability_level": readability_level,
        "timestamp": datetime.now().isoformat()
    }

def analyze_sentiment(text: str) -> Dict[str, Any]:
    """
    Analyze text for sentiment
    
    Args:
        text: The text to analyze
        
    Returns:
        Dictionary containing sentiment analysis results
    """
    logger.info("Analyzing sentiment")
    
    # Positive and negative word lists (simplified)
    positive_words = [
        'good', 'great', 'excellent', 'wonderful', 'amazing', 'awesome', 'fantastic', 
        'happy', 'joy', 'love', 'excited', 'positive', 'beautiful', 'brilliant', 
        'success', 'successful', 'win', 'winning', 'best', 'better', 'improved'
    ]
    
    negative_words = [
        'bad', 'terrible', 'awful', 'horrible', 'sad', 'unhappy', 'hate', 'dislike',
        'negative', 'poor', 'worst', 'worse', 'failure', 'failed', 'lose', 'losing',
        'problem', 'difficult', 'hard', 'impossible', 'wrong', 'error'
    ]
    
    # Count word occurrences
    text_lower = text.lower()
    word_pattern = r'\b\w+\b'
    all_words = re.findall(word_pattern, text_lower)
    
    positive_count = sum(1 for word in all_words if word in positive_words)
    negative_count = sum(1 for word in all_words if word in negative_words)
    total_count = len(all_words)
    
    # Calculate sentiment scores
    positive_score = positive_count / max(1, total_count) * 100
    negative_score = negative_count / max(1, total_count) * 100
    neutral_score = 100 - positive_score - negative_score
    
    # Overall sentiment score (-1 to 1)
    sentiment_score = (positive_score - negative_score) / 100
    
    # Sentiment category
    sentiment_category = "neutral"
    if sentiment_score > 0.2:
        sentiment_category = "positive"
    elif sentiment_score < -0.2:
        sentiment_category = "negative"
    
    return {
        "sentiment_score": round(sentiment_score, 2),
        "sentiment_category": sentiment_category,
        "positive_score": round(positive_score, 1),
        "negative_score": round(negative_score, 1),
        "neutral_score": round(neutral_score, 1),
        "word_count": total_count,
        "timestamp": datetime.now().isoformat()
    }

def summarize_text(text: str, max_length: int = 200) -> Dict[str, Any]:
    """
    Generate a simple summary of text
    
    Args:
        text: The text to summarize
        max_length: Maximum length of summary
        
    Returns:
        Dictionary containing summary
    """
    logger.info(f"Summarizing text (max length: {max_length})")
    
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    # Score sentences based on position and word frequency
    word_freq = {}
    for sentence in sentences:
        words = re.findall(r'\b\w+\b', sentence.lower())
        for word in words:
            if word not in word_freq:
                word_freq[word] = 0
            word_freq[word] += 1
    
    # Calculate sentence scores
    sentence_scores = []
    for i, sentence in enumerate(sentences):
        # Score based on position (first and last sentences often contain key info)
        position_score = 0
        if i == 0:
            position_score = 0.3
        elif i == len(sentences) - 1:
            position_score = 0.2
        
        # Score based on word frequency
        words = re.findall(r'\b\w+\b', sentence.lower())
        frequency_score = sum(word_freq.get(word, 0) for word in words) / max(1, len(words))
        
        # Score based on sentence length (prefer medium-length sentences)
        length = len(words)
        length_score = 0.5 if 8 <= length <= 20 else 0.0
        
        # Combined score
        score = position_score + 0.0001 * frequency_score + length_score
        
        sentence_scores.append((i, sentence, score))
    
    # Sort by score and select top sentences
    sentence_scores.sort(key=lambda x: x[2], reverse=True)
    
    # Select top sentences and sort by original position
    selected_sentences = []
    total_length = 0
    
    for i, sentence, score in sentence_scores:
        sentence_length = len(sentence)
        if total_length + sentence_length <= max_length:
            selected_sentences.append((i, sentence))
            total_length += sentence_length
        else:
            # If we can't fit the whole sentence, break
            break
    
    # Sort selected sentences by original position
    selected_sentences.sort(key=lambda x: x[0])
    
    # Combine sentences
    summary = ' '.join(sentence for _, sentence in selected_sentences)
    
    # Truncate if still too long
    if len(summary) > max_length:
        summary = summary[:max_length-3] + '...'
    
    return {
        "original_length": len(text),
        "summary_length": len(summary),
        "compression_ratio": round(len(summary) / max(1, len(text)), 2),
        "summary": summary,
        "timestamp": datetime.now().isoformat()
    }

async def process_text(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a text analysis request and return results
    
    Args:
        request_data: Dictionary containing the text analysis request parameters
        
    Returns:
        Dictionary containing the analysis results
    """
    text = request_data.get("text", "")
    if not text:
        return {
            "error": "No text provided",
            "status": "error"
        }
    
    operation = request_data.get("operation", "").lower()
    if not operation:
        return {
            "error": "No operation specified",
            "status": "error"
        }
    
    try:
        if operation == "grammar":
            results = analyze_grammar(text)
            
            # Format the results for easy reading
            formatted_issues = []
            for issue in results["issues"]:
                formatted_issues.append(
                    f"Line {issue['line']}: {issue['message']} - {issue['context']}"
                )
            
            result_text = (
                f"Grammar Analysis Results:\n"
                f"Word count: {results['word_count']}\n"
                f"Sentence count: {results['sentence_count']}\n"
                f"Readability: {results['readability_level']} (score: {results['readability_score']})\n"
                f"Issues found: {results['issue_count']}\n\n"
            )
            
            if formatted_issues:
                result_text += "Grammar Issues:\n" + "\n".join(formatted_issues)
            else:
                result_text += "No grammar issues found."
                
            results["result_text"] = result_text
            results["status"] = "success"
            
        elif operation == "sentiment":
            results = analyze_sentiment(text)
            
            result_text = (
                f"Sentiment Analysis Results:\n"
                f"Overall sentiment: {results['sentiment_category'].capitalize()} (score: {results['sentiment_score']})\n"
                f"Positive score: {results['positive_score']}%\n"
                f"Negative score: {results['negative_score']}%\n"
                f"Neutral score: {results['neutral_score']}%\n"
                f"Word count: {results['word_count']}"
            )
            
            results["result_text"] = result_text
            results["status"] = "success"
            
        elif operation == "summarize":
            max_length = int(request_data.get("max_length", 200))
            results = summarize_text(text, max_length)
            
            result_text = (
                f"Text Summarization Results:\n"
                f"Original length: {results['original_length']} characters\n"
                f"Summary length: {results['summary_length']} characters\n"
                f"Compression ratio: {results['compression_ratio']}\n\n"
                f"Summary:\n{results['summary']}"
            )
            
            results["result_text"] = result_text
            results["status"] = "success"
            
        else:
            return {
                "error": f"Unsupported operation: {operation}",
                "status": "error"
            }
        
        return results
        
    except Exception as e:
        logger.error(f"Error processing text: {str(e)}")
        return {
            "error": f"Error processing text: {str(e)}",
            "status": "error"
        }

# Example text for testing
EXAMPLE_TEXT = """
Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.

The term "artificial intelligence" had previously been used to describe machines that mimic and display "human" cognitive skills that are associated with the human mind, such as "learning" and "problem-solving". This definition has since been rejected by major AI researchers who now describe AI in terms of rationality and acting rationally, which does not limit how intelligence can be articulated.

AI applications include advanced web search engines (e.g., Google), recommendation systems (used by YouTube, Amazon and Netflix), understanding human speech (such as Siri and Alexa), self-driving cars (e.g., Waymo), generative or creative tools (ChatGPT and AI art), automated decision-making and competing at the highest level in strategic game systems (such as chess and Go).

As machines become increasingly capable, tasks considered to require "intelligence" are often removed from the definition of AI, a phenomenon known as the AI effect. For instance, optical character recognition is frequently excluded from things considered to be AI, having become a routine technology.
"""

# For testing
if __name__ == "__main__":
    import asyncio
    
    async def test():
        # Test grammar analysis
        grammar_result = await process_text({
            "text": EXAMPLE_TEXT,
            "operation": "grammar"
        })
        print("GRAMMAR ANALYSIS:")
        print(grammar_result["result_text"])
        print("\n" + "="*50 + "\n")
        
        # Test sentiment analysis
        sentiment_result = await process_text({
            "text": EXAMPLE_TEXT,
            "operation": "sentiment"
        })
        print("SENTIMENT ANALYSIS:")
        print(sentiment_result["result_text"])
        print("\n" + "="*50 + "\n")
        
        # Test summarization
        summary_result = await process_text({
            "text": EXAMPLE_TEXT,
            "operation": "summarize",
            "max_length": 150
        })
        print("SUMMARIZATION:")
        print(summary_result["result_text"])
        
    asyncio.run(test()) 