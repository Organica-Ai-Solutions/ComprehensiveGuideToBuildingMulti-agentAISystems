from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from environment or use SQLite as default
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agent_system.db")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=True)

# Create declarative base
Base = declarative_base()

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Enums
class AgentStatusEnum(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    IDLE = "idle"

class MessageTypeEnum(str, enum.Enum):
    TEXT = "text"
    SYSTEM = "system"
    ERROR = "error"
    TOOL = "tool"

# Models
class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    goal = Column(String)
    capabilities = Column(JSON)
    status = Column(SQLEnum(AgentStatusEnum), default=AgentStatusEnum.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    messages = relationship("Message", back_populates="agent")
    tools = relationship("Tool", secondary="agent_tools")
    conversations = relationship("Conversation", back_populates="agent")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("agents.id"))
    conversation_id = Column(String, ForeignKey("conversations.id"))
    content = Column(String, nullable=False)
    sender = Column(String, default="user")
    timestamp = Column(DateTime, default=datetime.utcnow)
    token_count = Column(Integer, default=0)
    message_type = Column(SQLEnum(MessageTypeEnum), default=MessageTypeEnum.TEXT)
    status = Column(String, default="pending")
    
    # Relationships
    agent = relationship("Agent", back_populates="messages")
    conversation = relationship("Conversation", back_populates="messages")

class Tool(Base):
    __tablename__ = "tools"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String)
    api_endpoint = Column(String)
    available = Column(String, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AgentTool(Base):
    __tablename__ = "agent_tools"

    agent_id = Column(String, ForeignKey("agents.id"), primary_key=True)
    tool_id = Column(String, ForeignKey("tools.id"), primary_key=True)

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("agents.id"))
    context_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("Agent", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

# Create all tables
def init_db():
    Base.metadata.create_all(bind=engine) 