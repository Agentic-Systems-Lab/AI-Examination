"""
Database Configuration and Session Management

This module handles database connection, session management, and provides
utility functions for database operations in the AI Examiner application.

Author: AI Assistant
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv
from typing import Generator

# Load environment variables
load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_examiner.db")

# Create SQLAlchemy engine
# For SQLite, we need to enable foreign key constraints and use check_same_thread=False
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False},
        echo=False  # Set to True for SQL query logging during development
    )
else:
    engine = create_engine(DATABASE_URL, echo=False)

# Create SessionLocal class for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_database_session() -> Generator[Session, None, None]:
    """
    Dependency function to get database session.
    
    This function creates a new database session for each request and ensures
    it's properly closed after the request is completed. It's designed to be
    used as a FastAPI dependency.
    
    Yields:
        Session: SQLAlchemy database session
        
    Example:
        @app.get("/example")
        def example_endpoint(db: Session = Depends(get_database_session)):
            # Use db session here
            pass
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_all_tables():
    """
    Create all database tables.
    
    This function creates all tables defined in the models.py file.
    It should be called during application startup to ensure all
    necessary tables exist.
    
    Note:
        This function is idempotent - it can be called multiple times
        without causing issues. Existing tables won't be modified.
    """
    from models import Base
    Base.metadata.create_all(bind=engine)

def drop_all_tables():
    """
    Drop all database tables.
    
    WARNING: This function will delete all data in the database.
    It should only be used during development or testing.
    
    Note:
        Use with extreme caution in production environments.
    """
    from models import Base
    Base.metadata.drop_all(bind=engine)

def init_database():
    """
    Initialize the database with necessary tables and initial data.
    
    This function sets up the database schema and can be extended
    to include initial data seeding if required.
    """
    print("Initializing database...")
    create_all_tables()
    print("Database initialization completed!")

# Database utility functions
class DatabaseManager:
    """
    Database manager class providing high-level database operations.
    
    This class encapsulates common database operations and provides
    a convenient interface for interacting with the database.
    """
    
    @staticmethod
    def get_session() -> Session:
        """
        Get a new database session.
        
        Returns:
            Session: New SQLAlchemy database session
            
        Note:
            Remember to close the session when done using it.
        """
        return SessionLocal()
    
    @staticmethod
    def execute_with_session(operation, *args, **kwargs):
        """
        Execute a database operation with automatic session management.
        
        This method handles session creation, execution, and cleanup
        automatically, reducing boilerplate code.
        
        Args:
            operation: Function to execute that takes a session as first parameter
            *args: Additional positional arguments for the operation
            **kwargs: Additional keyword arguments for the operation
            
        Returns:
            The result of the operation function
            
        Example:
            def get_user_by_id(session, user_id):
                return session.query(User).filter(User.id == user_id).first()
            
            user = DatabaseManager.execute_with_session(get_user_by_id, user_id=123)
        """
        session = SessionLocal()
        try:
            result = operation(session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    @staticmethod
    def test_connection() -> bool:
        """
        Test database connection.
        
        Returns:
            bool: True if connection is successful, False otherwise
        """
        try:
            session = SessionLocal()
            # Try to execute a simple query
            session.execute("SELECT 1")
            session.close()
            return True
        except Exception as e:
            print(f"Database connection test failed: {e}")
            return False

# Initialize database on module import
if __name__ == "__main__":
    # This block runs when the module is executed directly
    init_database()
else:
    # This runs when the module is imported
    # We'll initialize the database during startup in main.py
    pass 