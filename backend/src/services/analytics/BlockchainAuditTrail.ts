import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface AuditEvent {
  eventType: string;
  userId: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Block {
  index: number;
  timestamp: Date;
  data: AuditEvent[];
  previousHash: string;
  hash: string;
  nonce: number;
  merkleRoot: string;
}

export interface SmartContract {
  id: string;
  name: string;
  code: string;
  conditions: Record<string, any>;
  actions: string[];
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
}

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  votingPeriod: { start: Date; end: Date };
  votes: { userId: string; vote: 'yes' | 'no' | 'abstain'; weight: number }[];
  status: 'pending' | 'active' | 'passed' | 'rejected' | 'executed';
  requiredQuorum: number;
  executionTx?: string;
}

export interface QualityToken {
  id: string;
  userId: string;
  amount: number;
  earnedFor: string;
  timestamp: Date;
  blockHash: string;
}

export interface DecentralizedStorage {
  store(key: string, data: any): Promise<string>;
  retrieve(hash: string): Promise<any>;
  verify(hash: string, data: any): boolean;
}

export class BlockchainAuditTrail extends EventEmitter {
  private chain: Block[];
  private pendingEvents: AuditEvent[];
  private smartContracts: Map<string, SmartContract>;
  private governanceProposals: Map<string, GovernanceProposal>;
  private qualityTokens: Map<string, QualityToken[]>;
  private decentralizedStorage: DecentralizedStorage;
  private static instance: BlockchainAuditTrail;
  private readonly difficulty: number = 4;
  private readonly blockSize: number = 100;

  private constructor() {
    super();
    this.chain = [];
    this.pendingEvents = [];
    this.smartContracts = new Map();
    this.governanceProposals = new Map();
    this.qualityTokens = new Map();
    this.decentralizedStorage = new IPFSStorage();
    this.initializeGenesisBlock();
    this.setupAutomaticGovernance();
  }

  public static getInstance(): BlockchainAuditTrail {
    if (!BlockchainAuditTrail.instance) {
      BlockchainAuditTrail.instance = new BlockchainAuditTrail();
    }
    return BlockchainAuditTrail.instance;
  }

  /**
   * Record an audit event to the blockchain
   */
  public async recordAuditEvent(event: AuditEvent): Promise<string> {
    // Add cryptographic signature
    const signedEvent = await this.signEvent(event);
    
    // Add to pending events
    this.pendingEvents.push(signedEvent);
    
    // Check if we should mine a new block
    if (this.pendingEvents.length >= this.blockSize) {
      await this.mineBlock();
    }
    
    // Execute relevant smart contracts
    await this.executeSmartContracts(signedEvent);
    
    // Emit event for real-time monitoring
    this.emit('auditEventRecorded', signedEvent);
    
    return this.calculateEventHash(signedEvent);
  }

  /**
   * Mine a new block with pending events
   */
  public async mineBlock(): Promise<Block> {
    if (this.pendingEvents.length === 0) {
      throw new Error('No pending events to mine');
    }

    const index = this.chain.length;
    const timestamp = new Date();
    const previousHash = index === 0 ? '0' : this.chain[index - 1].hash;
    const data = [...this.pendingEvents];
    const merkleRoot = this.calculateMerkleRoot(data);
    
    // Proof of Work mining
    let nonce = 0;
    let hash = '';
    
    do {
      nonce++;
      hash = this.calculateBlockHash(index, timestamp, data, previousHash, nonce, merkleRoot);
    } while (hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0'));

    const block: Block = {
      index,
      timestamp,
      data,
      previousHash,
      hash,
      nonce,
      merkleRoot
    };

    // Add block to chain
    this.chain.push(block);
    
    // Store block in decentralized storage
    const storageHash = await this.decentralizedStorage.store(`block_${index}`, block);
    
    // Clear pending events
    this.pendingEvents = [];
    
    // Distribute quality tokens for contributions
    await this.distributeQualityTokens(block);
    
    // Emit block mined event
    this.emit('blockMined', block, storageHash);
    
    console.log(`Block ${index} mined with hash: ${hash}`);
    
    return block;
  }

  /**
   * Create and deploy a smart contract
   */
  public async createSmartContract(
    name: string,
    code: string,
    conditions: Record<string, any>,
    actions: string[],
    createdBy: string
  ): Promise<string> {
    const contractId = `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const contract: SmartContract = {
      id: contractId,
      name,
      code,
      conditions,
      actions,
      createdAt: new Date(),
      createdBy,
      isActive: true
    };

    this.smartContracts.set(contractId, contract);
    
    // Record contract creation in audit trail
    await this.recordAuditEvent({
      eventType: 'smart_contract_created',
      userId: createdBy,
      data: { contractId, name, conditions, actions },
      timestamp: new Date()
    });

    return contractId;
  }

  /**
   * Execute smart contracts based on events
   */
  private async executeSmartContracts(event: AuditEvent): Promise<void> {
    for (const [contractId, contract] of this.smartContracts) {
      if (!contract.isActive) continue;

      try {
        // Check if conditions are met
        const shouldExecute = this.evaluateContractConditions(contract, event);
        
        if (shouldExecute) {
          // Execute contract actions
          await this.executeContractActions(contract, event);
          
          // Record execution
          await this.recordAuditEvent({
            eventType: 'smart_contract_executed',
            userId: 'system',
            data: { contractId, triggeredBy: event },
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error(`Error executing smart contract ${contractId}:`, error);
        
        // Record error
        await this.recordAuditEvent({
          eventType: 'smart_contract_error',
          userId: 'system',
          data: { contractId, error: error.message },
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Create a governance proposal
   */
  public async createGovernanceProposal(
    title: string,
    description: string,
    proposer: string,
    votingPeriodDays: number = 7
  ): Promise<string> {
    const proposalId = `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const end = new Date(now.getTime() + (votingPeriodDays * 24 * 60 * 60 * 1000));
    
    const proposal: GovernanceProposal = {
      id: proposalId,
      title,
      description,
      proposer,
      votingPeriod: { start: now, end },
      votes: [],
      status: 'active',
      requiredQuorum: 0.5, // 50% of token holders
      executionTx: undefined
    };

    this.governanceProposals.set(proposalId, proposal);
    
    // Record proposal creation
    await this.recordAuditEvent({
      eventType: 'governance_proposal_created',
      userId: proposer,
      data: proposal,
      timestamp: new Date()
    });

    return proposalId;
  }

  /**
   * Vote on a governance proposal
   */
  public async voteOnProposal(
    proposalId: string,
    userId: string,
    vote: 'yes' | 'no' | 'abstain'
  ): Promise<void> {
    const proposal = this.governanceProposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status !== 'active') {
      throw new Error('Proposal is not active');
    }

    const now = new Date();
    if (now > proposal.votingPeriod.end) {
      throw new Error('Voting period has ended');
    }

    // Get user's token weight
    const userTokens = this.qualityTokens.get(userId) || [];
    const tokenWeight = userTokens.reduce((sum, token) => sum + token.amount, 0);

    // Remove previous vote if exists
    proposal.votes = proposal.votes.filter(v => v.userId !== userId);
    
    // Add new vote
    proposal.votes.push({
      userId,
      vote,
      weight: tokenWeight
    });

    // Record vote
    await this.recordAuditEvent({
      eventType: 'governance_vote_cast',
      userId,
      data: { proposalId, vote, weight: tokenWeight },
      timestamp: new Date()
    });

    // Check if proposal should be resolved
    await this.checkProposalResolution(proposalId);
  }

  /**
   * Distribute quality tokens for contributions
   */
  private async distributeQualityTokens(block: Block): Promise<void> {
    for (const event of block.data) {
      let tokenAmount = 0;
      
      // Calculate token rewards based on event type
      switch (event.eventType) {
        case 'prompt_created':
          tokenAmount = 10;
          break;
        case 'test_execution_success':
          tokenAmount = 5;
          break;
        case 'bug_report':
          tokenAmount = 15;
          break;
        case 'quality_improvement':
          tokenAmount = 20;
          break;
        case 'peer_review':
          tokenAmount = 8;
          break;
        default:
          tokenAmount = 1;
      }

      if (tokenAmount > 0) {
        await this.mintQualityTokens(event.userId, tokenAmount, event.eventType, block.hash);
      }
    }
  }

  /**
   * Mint quality tokens for a user
   */
  public async mintQualityTokens(
    userId: string,
    amount: number,
    earnedFor: string,
    blockHash: string
  ): Promise<void> {
    const token: QualityToken = {
      id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      amount,
      earnedFor,
      timestamp: new Date(),
      blockHash
    };

    if (!this.qualityTokens.has(userId)) {
      this.qualityTokens.set(userId, []);
    }
    
    this.qualityTokens.get(userId)!.push(token);

    // Record token minting
    await this.recordAuditEvent({
      eventType: 'quality_tokens_minted',
      userId,
      data: token,
      timestamp: new Date()
    });

    this.emit('qualityTokensMinted', token);
  }

  /**
   * Verify blockchain integrity
   */
  public verifyChainIntegrity(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Verify block hash
      if (currentBlock.hash !== this.calculateBlockHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash,
        currentBlock.nonce,
        currentBlock.merkleRoot
      )) {
        console.error(`Invalid hash at block ${i}`);
        return false;
      }

      // Verify previous hash link
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.error(`Invalid previous hash at block ${i}`);
        return false;
      }

      // Verify merkle root
      if (currentBlock.merkleRoot !== this.calculateMerkleRoot(currentBlock.data)) {
        console.error(`Invalid merkle root at block ${i}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get audit trail for specific entity
   */
  public getAuditTrail(entityId: string, entityType?: string): AuditEvent[] {
    const events: AuditEvent[] = [];
    
    for (const block of this.chain) {
      for (const event of block.data) {
        if (event.userId === entityId || 
            (event.data.entityId && event.data.entityId === entityId) ||
            (entityType && event.data.entityType === entityType)) {
          events.push(event);
        }
      }
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get user's quality token balance
   */
  public getQualityTokenBalance(userId: string): number {
    const tokens = this.qualityTokens.get(userId) || [];
    return tokens.reduce((sum, token) => sum + token.amount, 0);
  }

  /**
   * Get blockchain statistics
   */
  public getBlockchainStats(): {
    totalBlocks: number;
    totalEvents: number;
    totalContracts: number;
    totalProposals: number;
    totalTokenHolders: number;
    averageBlockTime: number;
    chainIntegrity: boolean;
  } {
    const totalEvents = this.chain.reduce((sum, block) => sum + block.data.length, 0);
    const totalTokenHolders = this.qualityTokens.size;
    
    let averageBlockTime = 0;
    if (this.chain.length > 1) {
      const totalTime = this.chain[this.chain.length - 1].timestamp.getTime() - this.chain[0].timestamp.getTime();
      averageBlockTime = totalTime / (this.chain.length - 1);
    }

    return {
      totalBlocks: this.chain.length,
      totalEvents,
      totalContracts: this.smartContracts.size,
      totalProposals: this.governanceProposals.size,
      totalTokenHolders,
      averageBlockTime,
      chainIntegrity: this.verifyChainIntegrity()
    };
  }

  // Private helper methods

  private initializeGenesisBlock(): void {
    const genesisBlock: Block = {
      index: 0,
      timestamp: new Date('2024-01-01T00:00:00Z'),
      data: [{
        eventType: 'genesis',
        userId: 'system',
        data: { message: 'Blockchain audit trail initialized' },
        timestamp: new Date('2024-01-01T00:00:00Z')
      }],
      previousHash: '0',
      hash: '',
      nonce: 0,
      merkleRoot: ''
    };

    genesisBlock.merkleRoot = this.calculateMerkleRoot(genesisBlock.data);
    genesisBlock.hash = this.calculateBlockHash(
      0,
      genesisBlock.timestamp,
      genesisBlock.data,
      '0',
      0,
      genesisBlock.merkleRoot
    );

    this.chain.push(genesisBlock);
  }

  private async signEvent(event: AuditEvent): Promise<AuditEvent> {
    const eventString = JSON.stringify(event);
    const signature = crypto.createHmac('sha256', 'audit_secret')
                           .update(eventString)
                           .digest('hex');
    
    return {
      ...event,
      metadata: {
        ...event.metadata,
        signature,
        hash: this.calculateEventHash(event)
      }
    };
  }

  private calculateEventHash(event: AuditEvent): string {
    const eventString = JSON.stringify(event);
    return crypto.createHash('sha256').update(eventString).digest('hex');
  }

  private calculateBlockHash(
    index: number,
    timestamp: Date,
    data: AuditEvent[],
    previousHash: string,
    nonce: number,
    merkleRoot: string
  ): string {
    const blockString = `${index}${timestamp.toISOString()}${JSON.stringify(data)}${previousHash}${nonce}${merkleRoot}`;
    return crypto.createHash('sha256').update(blockString).digest('hex');
  }

  private calculateMerkleRoot(data: AuditEvent[]): string {
    if (data.length === 0) return '';
    
    let hashes = data.map(event => this.calculateEventHash(event));
    
    while (hashes.length > 1) {
      const newHashes: string[] = [];
      
      for (let i = 0; i < hashes.length; i += 2) {
        if (i + 1 < hashes.length) {
          const combined = hashes[i] + hashes[i + 1];
          newHashes.push(crypto.createHash('sha256').update(combined).digest('hex'));
        } else {
          newHashes.push(hashes[i]);
        }
      }
      
      hashes = newHashes;
    }
    
    return hashes[0];
  }

  private evaluateContractConditions(contract: SmartContract, event: AuditEvent): boolean {
    // Simple condition evaluation - could be enhanced with a proper expression evaluator
    const conditions = contract.conditions;
    
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'eventType':
          if (event.eventType !== value) return false;
          break;
        case 'userId':
          if (event.userId !== value) return false;
          break;
        case 'dataContains':
          if (!JSON.stringify(event.data).includes(value)) return false;
          break;
      }
    }
    
    return true;
  }

  private async executeContractActions(contract: SmartContract, event: AuditEvent): Promise<void> {
    for (const action of contract.actions) {
      switch (action) {
        case 'mint_tokens':
          await this.mintQualityTokens(event.userId, 5, 'contract_execution', '');
          break;
        case 'create_proposal':
          // Auto-create governance proposal based on contract logic
          break;
        case 'alert_admin':
          this.emit('adminAlert', { contract, event });
          break;
      }
    }
  }

  private setupAutomaticGovernance(): void {
    // Set up default governance contracts
    this.createSmartContract(
      'Quality Assurance',
      'if test_success_rate < 0.8 then alert_admin',
      { eventType: 'batch_execution' },
      ['alert_admin'],
      'system'
    );
    
    this.createSmartContract(
      'Contribution Rewards',
      'if prompt_created then mint_tokens',
      { eventType: 'prompt_created' },
      ['mint_tokens'],
      'system'
    );
  }

  private async checkProposalResolution(proposalId: string): Promise<void> {
    const proposal = this.governanceProposals.get(proposalId);
    if (!proposal || proposal.status !== 'active') return;

    const now = new Date();
    const totalWeight = Array.from(this.qualityTokens.values())
      .flat()
      .reduce((sum, token) => sum + token.amount, 0);

    const votedWeight = proposal.votes.reduce((sum, vote) => sum + vote.weight, 0);
    const yesWeight = proposal.votes
      .filter(vote => vote.vote === 'yes')
      .reduce((sum, vote) => sum + vote.weight, 0);

    // Check if quorum is met and voting period ended
    if (now > proposal.votingPeriod.end || votedWeight >= totalWeight * proposal.requiredQuorum) {
      if (yesWeight > votedWeight * 0.5) {
        proposal.status = 'passed';
      } else {
        proposal.status = 'rejected';
      }

      // Record resolution
      await this.recordAuditEvent({
        eventType: 'governance_proposal_resolved',
        userId: 'system',
        data: { proposalId, status: proposal.status, votes: proposal.votes },
        timestamp: new Date()
      });
    }
  }
}

/**
 * IPFS-like decentralized storage implementation
 */
class IPFSStorage implements DecentralizedStorage {
  private storage: Map<string, any>;

  constructor() {
    this.storage = new Map();
  }

  async store(key: string, data: any): Promise<string> {
    const serialized = JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    this.storage.set(hash, data);
    return hash;
  }

  async retrieve(hash: string): Promise<any> {
    return this.storage.get(hash);
  }

  verify(hash: string, data: any): boolean {
    const serialized = JSON.stringify(data);
    const calculatedHash = crypto.createHash('sha256').update(serialized).digest('hex');
    return calculatedHash === hash;
  }
}