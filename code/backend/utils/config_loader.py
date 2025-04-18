import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class ConfigLoader:
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or Path(__file__).parent.parent / 'config.json'
        self.config: Dict[str, Any] = {}
        
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file."""
        try:
            with open(self.config_path) as f:
                self.config = json.load(f)
            self._validate_config()
            logger.info(f"Configuration loaded successfully from {self.config_path}")
            return self.config
        except FileNotFoundError:
            logger.error(f"Configuration file not found at {self.config_path}")
            raise
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in configuration file {self.config_path}")
            raise
            
    def _validate_config(self) -> None:
        """Validate required configuration fields."""
        required_sections = ['api', 'agents', 'tools', 'system', 'logging']
        
        for section in required_sections:
            if section not in self.config:
                raise ValueError(f"Missing required configuration section: {section}")
        
        # Validate API configuration
        api_config = self.config['api']
        if not isinstance(api_config.get('port'), int):
            raise ValueError("API port must be an integer")
            
        # Validate agent configuration
        agent_config = self.config['agents']
        if not isinstance(agent_config.get('max_agents'), int):
            raise ValueError("max_agents must be an integer")
            
        # Validate system limits
        system_config = self.config['system']
        if not all(isinstance(system_config.get(key), int) for key in ['max_context_size', 'max_message_length']):
            raise ValueError("System limits must be integers")
            
    def get_config(self) -> Dict[str, Any]:
        """Get the loaded configuration."""
        if not self.config:
            return self.load_config()
        return self.config
        
    def get_section(self, section: str) -> Dict[str, Any]:
        """Get a specific configuration section."""
        config = self.get_config()
        if section not in config:
            raise KeyError(f"Configuration section '{section}' not found")
        return config[section]

# Create a singleton instance
config_loader = ConfigLoader() 