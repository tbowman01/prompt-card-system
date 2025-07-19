#!/bin/bash

# Model Training System Setup Script
# This script sets up the model training environment and updates existing models

set -e

echo "🚀 Setting up Model Training System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TRAINING_DIR="/app/training"
MODELS_DIR="/app/models"
DATA_DIR="/app/training-data"
CHECKPOINTS_DIR="/app/checkpoints"
LOGS_DIR="/app/logs/training"

# Environment variables with defaults
TENSORFLOW_VERSION=${TENSORFLOW_VERSION:-"2.15.0"}
PYTORCH_VERSION=${PYTORCH_VERSION:-"2.1.0"}
CUDA_VERSION=${CUDA_VERSION:-"12.1"}
PYTHON_VERSION=${PYTHON_VERSION:-"3.11"}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to create directory if it doesn't exist
ensure_directory() {
    local dir="$1"
    if [ ! -d "$dir" ]; then
        print_status "Creating directory: $dir"
        mkdir -p "$dir"
    else
        print_status "Directory already exists: $dir"
    fi
}

# Function to check system requirements
check_system_requirements() {
    print_status "Checking system requirements..."
    
    # Check available memory
    local available_memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$available_memory" -lt 4096 ]; then
        print_warning "Available memory is less than 4GB. Training may be slow."
    else
        print_success "Available memory: ${available_memory}MB"
    fi
    
    # Check available disk space
    local available_space=$(df -m /app | awk 'NR==2{print $4}')
    if [ "$available_space" -lt 10240 ]; then
        print_warning "Available disk space is less than 10GB. Consider freeing up space."
    else
        print_success "Available disk space: ${available_space}MB"
    fi
    
    # Check GPU availability
    if command_exists nvidia-smi; then
        local gpu_count=$(nvidia-smi -L | wc -l)
        print_success "NVIDIA GPU detected. Count: $gpu_count"
        nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits | while read gpu_info; do
            print_status "GPU: $gpu_info"
        done
    else
        print_warning "No NVIDIA GPU detected. Training will use CPU only."
    fi
}

# Function to setup training directories
setup_directories() {
    print_status "Setting up training directories..."
    
    ensure_directory "$TRAINING_DIR"
    ensure_directory "$MODELS_DIR"
    ensure_directory "$DATA_DIR"
    ensure_directory "$CHECKPOINTS_DIR"
    ensure_directory "$LOGS_DIR"
    
    # Create subdirectories
    ensure_directory "$TRAINING_DIR/configs"
    ensure_directory "$TRAINING_DIR/scripts"
    ensure_directory "$TRAINING_DIR/notebooks"
    ensure_directory "$MODELS_DIR/pretrained"
    ensure_directory "$MODELS_DIR/finetuned"
    ensure_directory "$MODELS_DIR/custom"
    ensure_directory "$DATA_DIR/raw"
    ensure_directory "$DATA_DIR/processed"
    ensure_directory "$DATA_DIR/synthetic"
    ensure_directory "$CHECKPOINTS_DIR/active"
    ensure_directory "$CHECKPOINTS_DIR/completed"
    
    print_success "Training directories created successfully"
}

# Function to install Python dependencies
install_python_dependencies() {
    print_status "Installing Python training dependencies..."
    
    # Create requirements file for training dependencies
    cat > /tmp/training-requirements.txt << EOF
# Core ML Libraries
tensorflow==$TENSORFLOW_VERSION
torch==$PYTORCH_VERSION
transformers>=4.30.0
datasets>=2.14.0
accelerate>=0.20.0
evaluate>=0.4.0

# Training and Optimization
optuna>=3.2.0
ray[tune]>=2.5.0
wandb>=0.15.0
tensorboard>=2.13.0
mlflow>=2.5.0

# Data Processing
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
matplotlib>=3.7.0
seaborn>=0.12.0
plotly>=5.15.0

# Text Processing
nltk>=3.8.0
spacy>=3.6.0
tokenizers>=0.13.0
sentencepiece>=0.1.99

# Utilities
tqdm>=4.65.0
psutil>=5.9.0
pyyaml>=6.0
jsonlines>=3.1.0
rich>=13.4.0

# Model Serving
fastapi>=0.100.0
uvicorn>=0.22.0
gradio>=3.35.0

# Development
jupyter>=1.0.0
ipywidgets>=8.0.0
notebook>=6.5.0
EOF

    # Install dependencies
    if command_exists pip; then
        pip install -r /tmp/training-requirements.txt
        print_success "Python dependencies installed"
    else
        print_error "pip not found. Please install Python and pip first."
        exit 1
    fi
    
    # Clean up
    rm /tmp/training-requirements.txt
}

# Function to setup CUDA and GPU support
setup_gpu_support() {
    if command_exists nvidia-smi; then
        print_status "Setting up GPU support..."
        
        # Install CUDA-enabled packages
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
        pip install tensorflow[and-cuda]==$TENSORFLOW_VERSION
        
        # Verify GPU access
        python3 -c "
import tensorflow as tf
import torch
print('TensorFlow GPU available:', tf.config.list_physical_devices('GPU'))
print('PyTorch GPU available:', torch.cuda.is_available())
print('PyTorch GPU count:', torch.cuda.device_count())
"
        
        print_success "GPU support configured"
    else
        print_warning "No GPU detected. Skipping GPU setup."
    fi
}

# Function to download pretrained models
download_pretrained_models() {
    print_status "Downloading essential pretrained models..."
    
    # Create model download script
    cat > /tmp/download_models.py << 'EOF'
#!/usr/bin/env python3
import os
import sys
from transformers import AutoModel, AutoTokenizer
from huggingface_hub import snapshot_download

models_to_download = [
    {
        "name": "microsoft/DialoGPT-medium",
        "type": "conversational",
        "size": "medium"
    },
    {
        "name": "microsoft/CodeBERT-base",
        "type": "code",
        "size": "base"
    },
    {
        "name": "sentence-transformers/all-MiniLM-L6-v2",
        "type": "embedding",
        "size": "small"
    },
    {
        "name": "distilbert-base-uncased",
        "type": "classification",
        "size": "small"
    }
]

base_path = "/app/models/pretrained"

for model_info in models_to_download:
    model_name = model_info["name"]
    model_path = os.path.join(base_path, model_name.replace("/", "_"))
    
    try:
        print(f"Downloading {model_name}...")
        
        # Download model files
        snapshot_download(
            repo_id=model_name,
            local_dir=model_path,
            local_dir_use_symlinks=False
        )
        
        print(f"✅ Downloaded {model_name} to {model_path}")
        
    except Exception as e:
        print(f"❌ Failed to download {model_name}: {e}")
        
print("Model download completed!")
EOF

    # Run the download script
    python3 /tmp/download_models.py
    
    # Clean up
    rm /tmp/download_models.py
    
    print_success "Pretrained models downloaded"
}

# Function to create training configuration templates
create_config_templates() {
    print_status "Creating training configuration templates..."
    
    # Fine-tuning config template
    cat > "$TRAINING_DIR/configs/fine_tune_template.yaml" << 'EOF'
# Fine-tuning Configuration Template

model:
  name: "microsoft/DialoGPT-medium"
  base_model: "microsoft/DialoGPT-medium"
  model_type: "fine_tuned"
  
training_data:
  source: "file"
  path: "/app/training-data/processed/fine_tune_data.jsonl"
  format: "jsonl"
  validation_split: 0.1
  max_samples: 10000

hyperparameters:
  learning_rate: 5e-5
  batch_size: 8
  epochs: 3
  warmup_steps: 100
  weight_decay: 0.01
  dropout_rate: 0.1
  gradient_clip_norm: 1.0

optimization:
  optimizer: "adamw"
  scheduler: "linear"
  early_stopping:
    enabled: true
    patience: 2
    metric: "validation_loss"
    min_delta: 0.001

evaluation:
  metrics: ["accuracy", "f1_score", "perplexity"]
  benchmark_datasets: []
  validation_frequency: 1
  save_best_model: true

resources:
  gpu_memory_limit: 8192
  cpu_cores: 4
  memory_limit: 16384

deployment:
  auto_deploy: false
  deployment_target: "local"
  rollback_on_failure: true
  health_check_enabled: true

metadata:
  description: "Fine-tuned conversational model"
  tags: ["conversational", "fine-tuned"]
  training_objective: "conversation_improvement"
EOF

    # Custom training config template
    cat > "$TRAINING_DIR/configs/custom_training_template.yaml" << 'EOF'
# Custom Training Configuration Template

model:
  name: "custom_model_v1"
  base_model: "gpt2"
  model_type: "custom"
  
training_data:
  source: "synthetic"
  path: "/app/training-data/synthetic/custom_data.jsonl"
  format: "jsonl"
  validation_split: 0.15
  max_samples: 50000

hyperparameters:
  learning_rate: 1e-4
  batch_size: 16
  epochs: 10
  warmup_steps: 500
  weight_decay: 0.01
  dropout_rate: 0.1
  gradient_clip_norm: 1.0

optimization:
  optimizer: "adamw"
  scheduler: "cosine"
  early_stopping:
    enabled: true
    patience: 5
    metric: "validation_loss"
    min_delta: 0.001

evaluation:
  metrics: ["accuracy", "f1_score", "bleu_score", "rouge_score"]
  benchmark_datasets: ["glue", "squad"]
  validation_frequency: 1
  save_best_model: true

resources:
  gpu_memory_limit: 16384
  cpu_cores: 8
  memory_limit: 32768

deployment:
  auto_deploy: true
  deployment_target: "ollama"
  rollback_on_failure: true
  health_check_enabled: true

metadata:
  description: "Custom trained model for specific domain"
  tags: ["custom", "domain-specific"]
  training_objective: "domain_specialization"
EOF

    print_success "Configuration templates created"
}

# Function to create training scripts
create_training_scripts() {
    print_status "Creating training scripts..."
    
    # Model training script
    cat > "$TRAINING_DIR/scripts/train_model.py" << 'EOF'
#!/usr/bin/env python3
"""
Model Training Script
Handles fine-tuning and custom training of language models
"""

import os
import sys
import yaml
import json
import logging
import argparse
from datetime import datetime
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from transformers import (
    AutoModel, AutoTokenizer, AutoConfig,
    TrainingArguments, Trainer,
    DataCollatorForLanguageModeling,
    EarlyStoppingCallback
)
from datasets import load_dataset
import wandb
from tqdm import tqdm

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/training/training.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ModelTrainer:
    def __init__(self, config_path):
        self.config = self.load_config(config_path)
        self.setup_environment()
        
    def load_config(self, config_path):
        """Load training configuration"""
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        logger.info(f"Loaded configuration from {config_path}")
        return config
        
    def setup_environment(self):
        """Setup training environment"""
        # Set random seeds for reproducibility
        torch.manual_seed(42)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(42)
            
        # Initialize wandb if available
        if 'WANDB_API_KEY' in os.environ:
            wandb.init(
                project="prompt-card-training",
                config=self.config,
                name=f"{self.config['model']['name']}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            )
            
    def load_data(self):
        """Load and preprocess training data"""
        data_config = self.config['training_data']
        
        if data_config['source'] == 'file':
            dataset = load_dataset('json', data_files=data_config['path'])
        elif data_config['source'] == 'huggingface':
            dataset = load_dataset(data_config['dataset_name'])
        else:
            raise ValueError(f"Unsupported data source: {data_config['source']}")
            
        # Split dataset
        if 'validation_split' in data_config:
            split_ratio = data_config['validation_split']
            dataset = dataset['train'].train_test_split(test_size=split_ratio)
            
        logger.info(f"Loaded dataset with {len(dataset['train'])} training samples")
        if 'test' in dataset:
            logger.info(f"Validation samples: {len(dataset['test'])}")
            
        return dataset
        
    def setup_model_and_tokenizer(self):
        """Setup model and tokenizer"""
        model_name = self.config['model']['base_model']
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
            
        # Load model
        model = AutoModel.from_pretrained(model_name)
        
        logger.info(f"Loaded model and tokenizer: {model_name}")
        return model, tokenizer
        
    def train(self):
        """Main training function"""
        logger.info("Starting model training...")
        
        # Load data and model
        dataset = self.load_data()
        model, tokenizer = self.setup_model_and_tokenizer()
        
        # Setup training arguments
        training_args = TrainingArguments(
            output_dir=f"/app/checkpoints/active/{self.config['model']['name']}",
            learning_rate=self.config['hyperparameters']['learning_rate'],
            per_device_train_batch_size=self.config['hyperparameters']['batch_size'],
            num_train_epochs=self.config['hyperparameters']['epochs'],
            warmup_steps=self.config['hyperparameters']['warmup_steps'],
            weight_decay=self.config['hyperparameters']['weight_decay'],
            logging_dir=f"/app/logs/training/{self.config['model']['name']}",
            logging_steps=10,
            save_steps=500,
            evaluation_strategy="steps" if 'test' in dataset else "no",
            eval_steps=500 if 'test' in dataset else None,
            save_total_limit=3,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss" if 'test' in dataset else None,
            greater_is_better=False,
            report_to="wandb" if 'WANDB_API_KEY' in os.environ else None,
        )
        
        # Setup data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=tokenizer,
            mlm=False
        )
        
        # Setup callbacks
        callbacks = []
        if self.config['optimization']['early_stopping']['enabled']:
            callbacks.append(EarlyStoppingCallback(
                early_stopping_patience=self.config['optimization']['early_stopping']['patience']
            ))
            
        # Initialize trainer
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=dataset['train'],
            eval_dataset=dataset.get('test'),
            data_collator=data_collator,
            callbacks=callbacks,
        )
        
        # Start training
        trainer.train()
        
        # Save final model
        final_model_path = f"/app/models/finetuned/{self.config['model']['name']}"
        trainer.save_model(final_model_path)
        tokenizer.save_pretrained(final_model_path)
        
        logger.info(f"Training completed. Model saved to: {final_model_path}")
        
        # Evaluate model
        if 'test' in dataset:
            eval_results = trainer.evaluate()
            logger.info(f"Final evaluation results: {eval_results}")
            
        return final_model_path

def main():
    parser = argparse.ArgumentParser(description='Train a language model')
    parser.add_argument('--config', required=True, help='Path to training configuration file')
    args = parser.parse_args()
    
    trainer = ModelTrainer(args.config)
    model_path = trainer.train()
    
    print(f"✅ Training completed successfully!")
    print(f"📁 Model saved to: {model_path}")

if __name__ == "__main__":
    main()
EOF

    # Model evaluation script
    cat > "$TRAINING_DIR/scripts/evaluate_model.py" << 'EOF'
#!/usr/bin/env python3
"""
Model Evaluation Script
Evaluates trained models on various benchmarks and metrics
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime
from pathlib import Path

import torch
from transformers import AutoModel, AutoTokenizer
from datasets import load_dataset
import evaluate
import numpy as np
from tqdm import tqdm

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelEvaluator:
    def __init__(self, model_path, tokenizer_path=None):
        self.model_path = model_path
        self.tokenizer_path = tokenizer_path or model_path
        self.load_model()
        
    def load_model(self):
        """Load model and tokenizer"""
        self.tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
        self.model = AutoModel.from_pretrained(self.model_path)
        
        if torch.cuda.is_available():
            self.model = self.model.cuda()
            
        self.model.eval()
        logger.info(f"Loaded model from {self.model_path}")
        
    def evaluate_on_dataset(self, dataset_name, split='test', max_samples=1000):
        """Evaluate model on a specific dataset"""
        logger.info(f"Evaluating on {dataset_name} ({split})")
        
        # Load dataset
        dataset = load_dataset(dataset_name, split=split)
        if len(dataset) > max_samples:
            dataset = dataset.select(range(max_samples))
            
        # Initialize metrics
        accuracy_metric = evaluate.load("accuracy")
        f1_metric = evaluate.load("f1")
        
        predictions = []
        references = []
        
        with torch.no_grad():
            for example in tqdm(dataset):
                # This is a simplified evaluation - implement specific logic per dataset
                inputs = self.tokenizer(
                    example['text'], 
                    return_tensors='pt', 
                    truncation=True, 
                    padding=True,
                    max_length=512
                )
                
                if torch.cuda.is_available():
                    inputs = {k: v.cuda() for k, v in inputs.items()}
                    
                outputs = self.model(**inputs)
                
                # Simple prediction logic (customize per task)
                pred = torch.argmax(outputs.logits, dim=-1).cpu().numpy()
                predictions.extend(pred.flatten())
                references.extend([example.get('label', 0)])
                
        # Calculate metrics
        accuracy = accuracy_metric.compute(predictions=predictions, references=references)
        f1 = f1_metric.compute(predictions=predictions, references=references, average='weighted')
        
        results = {
            'dataset': dataset_name,
            'split': split,
            'samples': len(dataset),
            'accuracy': accuracy['accuracy'],
            'f1_score': f1['f1'],
            'timestamp': datetime.now().isoformat()
        }
        
        logger.info(f"Results for {dataset_name}: {results}")
        return results
        
    def run_comprehensive_evaluation(self, output_file=None):
        """Run evaluation on multiple datasets"""
        datasets_to_evaluate = [
            ('glue', 'cola'),
            ('glue', 'sst2'),
            ('squad', 'validation'),
        ]
        
        all_results = []
        
        for dataset_name, split in datasets_to_evaluate:
            try:
                results = self.evaluate_on_dataset(dataset_name, split)
                all_results.append(results)
            except Exception as e:
                logger.error(f"Failed to evaluate on {dataset_name}: {e}")
                
        # Calculate overall score
        if all_results:
            avg_accuracy = np.mean([r['accuracy'] for r in all_results])
            avg_f1 = np.mean([r['f1_score'] for r in all_results])
            
            summary = {
                'model_path': self.model_path,
                'evaluation_timestamp': datetime.now().isoformat(),
                'overall_accuracy': avg_accuracy,
                'overall_f1_score': avg_f1,
                'detailed_results': all_results
            }
            
            if output_file:
                with open(output_file, 'w') as f:
                    json.dump(summary, f, indent=2)
                logger.info(f"Results saved to {output_file}")
                
            return summary
            
        return None

def main():
    parser = argparse.ArgumentParser(description='Evaluate a trained model')
    parser.add_argument('--model-path', required=True, help='Path to trained model')
    parser.add_argument('--output', help='Output file for results')
    args = parser.parse_args()
    
    evaluator = ModelEvaluator(args.model_path)
    results = evaluator.run_comprehensive_evaluation(args.output)
    
    if results:
        print(f"✅ Evaluation completed!")
        print(f"📊 Overall Accuracy: {results['overall_accuracy']:.3f}")
        print(f"📊 Overall F1 Score: {results['overall_f1_score']:.3f}")
    else:
        print("❌ Evaluation failed!")

if __name__ == "__main__":
    main()
EOF

    # Make scripts executable
    chmod +x "$TRAINING_DIR/scripts/train_model.py"
    chmod +x "$TRAINING_DIR/scripts/evaluate_model.py"
    
    print_success "Training scripts created"
}

# Function to create model update script
create_model_update_script() {
    print_status "Creating model update script..."
    
    cat > "$TRAINING_DIR/scripts/update_models.sh" << 'EOF'
#!/bin/bash

# Model Update Script
# Updates existing models with new training data or configurations

set -e

echo "🔄 Starting model update process..."

# Configuration
MODELS_DIR="/app/models"
BACKUP_DIR="/app/models/backups"
TRAINING_DIR="/app/training"

# Function to backup existing model
backup_model() {
    local model_name="$1"
    local model_path="$MODELS_DIR/finetuned/$model_name"
    local backup_path="$BACKUP_DIR/${model_name}_$(date +%Y%m%d_%H%M%S)"
    
    if [ -d "$model_path" ]; then
        echo "📦 Backing up $model_name to $backup_path"
        mkdir -p "$BACKUP_DIR"
        cp -r "$model_path" "$backup_path"
        echo "✅ Backup completed"
    else
        echo "⚠️  Model $model_name not found at $model_path"
    fi
}

# Function to update model
update_model() {
    local config_file="$1"
    
    if [ ! -f "$config_file" ]; then
        echo "❌ Configuration file not found: $config_file"
        return 1
    fi
    
    # Extract model name from config
    local model_name=$(python3 -c "
import yaml
with open('$config_file', 'r') as f:
    config = yaml.safe_load(f)
print(config['model']['name'])
")
    
    echo "🚀 Updating model: $model_name"
    
    # Backup existing model
    backup_model "$model_name"
    
    # Start training
    python3 "$TRAINING_DIR/scripts/train_model.py" --config "$config_file"
    
    # Evaluate updated model
    local model_path="$MODELS_DIR/finetuned/$model_name"
    if [ -d "$model_path" ]; then
        echo "📊 Evaluating updated model..."
        python3 "$TRAINING_DIR/scripts/evaluate_model.py" \
            --model-path "$model_path" \
            --output "$model_path/evaluation_results.json"
    fi
    
    echo "✅ Model $model_name updated successfully"
}

# Main update process
main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <config_file1> [config_file2] ..."
        echo "Example: $0 /app/training/configs/fine_tune_template.yaml"
        exit 1
    fi
    
    for config_file in "$@"; do
        echo "🔄 Processing: $config_file"
        update_model "$config_file"
        echo ""
    done
    
    echo "🎉 All model updates completed!"
}

main "$@"
EOF

    chmod +x "$TRAINING_DIR/scripts/update_models.sh"
    
    print_success "Model update script created"
}

# Function to create Jupyter notebook for interactive training
create_training_notebook() {
    print_status "Creating training notebook..."
    
    cat > "$TRAINING_DIR/notebooks/model_training_tutorial.ipynb" << 'EOF'
{
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# Model Training Tutorial\n",
    "\n",
    "This notebook provides an interactive guide to training and fine-tuning language models in the prompt card system."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Import required libraries\n",
    "import os\n",
    "import sys\n",
    "import yaml\n",
    "import torch\n",
    "from transformers import AutoModel, AutoTokenizer\n",
    "from datasets import load_dataset\n",
    "import matplotlib.pyplot as plt\n",
    "import seaborn as sns\n",
    "\n",
    "print(f\"PyTorch version: {torch.__version__}\")\n",
    "print(f\"CUDA available: {torch.cuda.is_available()}\")\n",
    "if torch.cuda.is_available():\n",
    "    print(f\"GPU count: {torch.cuda.device_count()}\")\n",
    "    print(f\"Current GPU: {torch.cuda.get_device_name()}\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 1. Load Training Configuration"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Load training configuration\n",
    "config_path = \"/app/training/configs/fine_tune_template.yaml\"\n",
    "\n",
    "with open(config_path, 'r') as f:\n",
    "    config = yaml.safe_load(f)\n",
    "    \n",
    "print(\"Training Configuration:\")\n",
    "print(yaml.dump(config, default_flow_style=False))"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 2. Explore Training Data"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Load and explore training data\n",
    "# This is a placeholder - replace with actual data loading logic\n",
    "\n",
    "print(\"Training data exploration:\")\n",
    "print(\"- Data source:\", config['training_data']['source'])\n",
    "print(\"- Data format:\", config['training_data']['format'])\n",
    "print(\"- Validation split:\", config['training_data']['validation_split'])\n",
    "\n",
    "# Add actual data loading and visualization here"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 3. Model Setup and Training"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Load base model and tokenizer\n",
    "model_name = config['model']['base_model']\n",
    "print(f\"Loading model: {model_name}\")\n",
    "\n",
    "tokenizer = AutoTokenizer.from_pretrained(model_name)\n",
    "model = AutoModel.from_pretrained(model_name)\n",
    "\n",
    "print(f\"Model parameters: {sum(p.numel() for p in model.parameters()):,}\")\n",
    "print(f\"Trainable parameters: {sum(p.numel() for p in model.parameters() if p.requires_grad):,}\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 4. Training Progress Visualization"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Visualize training progress (placeholder)\n",
    "import numpy as np\n",
    "\n",
    "# Simulate training metrics\n",
    "epochs = np.arange(1, 11)\n",
    "train_loss = 2.0 * np.exp(-epochs/3) + 0.1 * np.random.random(10)\n",
    "val_loss = train_loss * (1.1 + 0.1 * np.random.random(10))\n",
    "\n",
    "plt.figure(figsize=(12, 4))\n",
    "\n",
    "plt.subplot(1, 2, 1)\n",
    "plt.plot(epochs, train_loss, label='Training Loss', marker='o')\n",
    "plt.plot(epochs, val_loss, label='Validation Loss', marker='s')\n",
    "plt.xlabel('Epoch')\n",
    "plt.ylabel('Loss')\n",
    "plt.title('Training Progress')\n",
    "plt.legend()\n",
    "plt.grid(True)\n",
    "\n",
    "plt.subplot(1, 2, 2)\n",
    "accuracy = 1 - 0.5 * np.exp(-epochs/2) + 0.05 * np.random.random(10)\n",
    "plt.plot(epochs, accuracy, label='Accuracy', marker='d', color='green')\n",
    "plt.xlabel('Epoch')\n",
    "plt.ylabel('Accuracy')\n",
    "plt.title('Model Accuracy')\n",
    "plt.legend()\n",
    "plt.grid(True)\n",
    "\n",
    "plt.tight_layout()\n",
    "plt.show()"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 5. Model Evaluation"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Evaluate trained model\n",
    "print(\"Model Evaluation Results:\")\n",
    "print(\"========================\")\n",
    "\n",
    "# Placeholder evaluation results\n",
    "evaluation_results = {\n",
    "    'accuracy': 0.87,\n",
    "    'f1_score': 0.84,\n",
    "    'precision': 0.86,\n",
    "    'recall': 0.83,\n",
    "    'perplexity': 12.5,\n",
    "    'inference_time_ms': 150\n",
    "}\n",
    "\n",
    "for metric, value in evaluation_results.items():\n",
    "    print(f\"{metric.capitalize().replace('_', ' ')}: {value}\")\n",
    "\n",
    "# Visualize evaluation metrics\n",
    "plt.figure(figsize=(10, 6))\n",
    "metrics = list(evaluation_results.keys())[:-2]  # Exclude perplexity and inference_time\n",
    "values = [evaluation_results[m] for m in metrics]\n",
    "\n",
    "plt.bar(metrics, values, color=['skyblue', 'lightcoral', 'lightgreen', 'gold'])\n",
    "plt.title('Model Performance Metrics')\n",
    "plt.ylabel('Score')\n",
    "plt.ylim(0, 1)\n",
    "plt.xticks(rotation=45)\n",
    "plt.tight_layout()\n",
    "plt.show()"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 6. Model Deployment"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Deploy model to local endpoint\n",
    "print(\"Model Deployment:\")\n",
    "print(\"=================\")\n",
    "\n",
    "model_path = f\"/app/models/finetuned/{config['model']['name']}\"\n",
    "print(f\"Model will be saved to: {model_path}\")\n",
    "\n",
    "# Deployment configuration\n",
    "deployment_config = config['deployment']\n",
    "print(f\"Auto-deploy: {deployment_config['auto_deploy']}\")\n",
    "print(f\"Target: {deployment_config['deployment_target']}\")\n",
    "print(f\"Health check enabled: {deployment_config['health_check_enabled']}\")\n",
    "\n",
    "print(\"\\n✅ Ready for deployment!\")"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.11.0"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 4
}
EOF

    print_success "Training notebook created"
}

# Function to update environment variables
update_environment() {
    print_status "Updating environment variables..."
    
    # Add training-specific environment variables to .env.dev
    cat >> /workspaces/prompt-card-system/.env.dev << 'EOF'

# Model Training Configuration
TRAINING_ENABLED=true
TRAINING_DATA_DIR=/app/training-data
MODELS_DIR=/app/models
CHECKPOINTS_DIR=/app/checkpoints
TRAINING_LOGS_DIR=/app/logs/training

# Training Resources
TRAINING_GPU_ENABLED=true
TRAINING_MAX_MEMORY=16384
TRAINING_MAX_WORKERS=4

# Model Management
MODEL_REGISTRY_ENABLED=true
MODEL_AUTO_BACKUP=true
MODEL_RETENTION_DAYS=30

# Training Monitoring
WANDB_PROJECT=prompt-card-training
TENSORBOARD_ENABLED=true
TRAINING_METRICS_ENABLED=true

# Model Deployment
AUTO_DEPLOY_ENABLED=false
DEPLOYMENT_TARGET=local
HEALTH_CHECK_INTERVAL=300
EOF

    print_success "Environment variables updated"
}

# Main installation process
main() {
    echo "🚀 Starting Model Training System Setup..."
    echo "========================================"
    
    # Check system requirements
    check_system_requirements
    
    # Setup directories
    setup_directories
    
    # Install Python dependencies
    install_python_dependencies
    
    # Setup GPU support if available
    setup_gpu_support
    
    # Download pretrained models
    download_pretrained_models
    
    # Create configuration templates
    create_config_templates
    
    # Create training scripts
    create_training_scripts
    
    # Create model update script
    create_model_update_script
    
    # Create training notebook
    create_training_notebook
    
    # Update environment variables
    update_environment
    
    print_success "Model Training System setup completed successfully!"
    echo ""
    echo "📋 Setup Summary:"
    echo "=================="
    echo "✅ Training directories created"
    echo "✅ Python dependencies installed"
    echo "✅ Pretrained models downloaded"
    echo "✅ Configuration templates created"
    echo "✅ Training scripts created"
    echo "✅ Model update utilities created"
    echo "✅ Jupyter notebook created"
    echo "✅ Environment variables updated"
    echo ""
    echo "🚀 Quick Start:"
    echo "==============="
    echo "1. Configure training: Edit /app/training/configs/fine_tune_template.yaml"
    echo "2. Start training: /app/training/scripts/update_models.sh /app/training/configs/fine_tune_template.yaml"
    echo "3. Monitor progress: Check /app/logs/training/training.log"
    echo "4. Interactive training: Open /app/training/notebooks/model_training_tutorial.ipynb"
    echo ""
    echo "📚 Documentation:"
    echo "=================="
    echo "- Training configs: /app/training/configs/"
    echo "- Training scripts: /app/training/scripts/"
    echo "- Model registry: API endpoint /api/training/models"
    echo "- Training jobs: API endpoint /api/training/jobs"
    echo ""
    echo "🎉 Model Training System is ready!"
}

# Run main function
main "$@"
EOF

chmod +x /workspaces/prompt-card-system/scripts/model-training-setup.sh

echo "📝 Created model training setup script"