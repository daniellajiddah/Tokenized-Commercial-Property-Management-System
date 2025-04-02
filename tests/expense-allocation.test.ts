import { describe, it, expect, beforeEach } from 'vitest';

// Mock implementation for testing the expense allocation contract
const mockExpenseAllocation = {
  ownershipShares: new Map(),
  expenses: new Map(),
  paymentAllocations: new Map(),
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  
  registerShare(sender, propertyId, owner, percentage) {
    if (sender !== this.contractOwner && sender !== owner) {
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    if (percentage > 100) {
      return { type: 'err', value: 4 }; // ERR_INVALID_PERCENTAGE
    }
    
    const shareKey = `${propertyId}-${owner}`;
    this.ownershipShares.set(shareKey, {
      percentage,
      lastUpdated: Date.now()
    });
    
    return { type: 'ok', value: true };
  },
  
  recordExpense(sender, propertyId, expenseId, description, amount, category) {
    const expenseKey = `${propertyId}-${expenseId}`;
    
    if (this.expenses.has(expenseKey)) {
      return { type: 'err', value: 2 }; // ERR_ALREADY_EXISTS
    }
    
    this.expenses.set(expenseKey, {
      description,
      amount,
      date: Date.now(),
      category,
      paidBy: sender,
      distributed: false
    });
    
    return { type: 'ok', value: true };
  },
  
  distributeExpense(sender, propertyId, expenseId) {
    const expenseKey = `${propertyId}-${expenseId}`;
    
    if (!this.expenses.has(expenseKey)) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    const expense = this.expenses.get(expenseKey);
    if (expense.distributed) {
      return { type: 'err', value: 5 }; // ERR_ALREADY_DISTRIBUTED
    }
    
    expense.distributed = true;
    this.expenses.set(expenseKey, expense);
    
    return { type: 'ok', value: true };
  },
  
  allocateExpense(sender, propertyId, expenseId, owner) {
    const expenseKey = `${propertyId}-${expenseId}`;
    const shareKey = `${propertyId}-${owner}`;
    const allocationKey = `${propertyId}-${expenseId}-${owner}`;
    
    if (!this.expenses.has(expenseKey)) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    if (!this.ownershipShares.has(shareKey)) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    const expense = this.expenses.get(expenseKey);
    if (!expense.distributed) {
      return { type: 'err', value: 5 }; // ERR_ALREADY_DISTRIBUTED (using this for "not distributed yet")
    }
    
    const share = this.ownershipShares.get(shareKey);
    const amountDue = Math.floor((expense.amount * share.percentage) / 100);
    
    this.paymentAllocations.set(allocationKey, {
      amountDue,
      paid: false,
      paymentDate: null
    });
    
    return { type: 'ok', value: amountDue };
  },
  
  recordPayment(sender, propertyId, expenseId) {
    const allocationKey = `${propertyId}-${expenseId}-${sender}`;
    
    if (!this.paymentAllocations.has(allocationKey)) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    const allocation = this.paymentAllocations.get(allocationKey);
    if (allocation.paid) {
      return { type: 'err', value: 6 }; // Already paid
    }
    
    allocation.paid = true;
    allocation.paymentDate = Date.now();
    this.paymentAllocations.set(allocationKey, allocation);
    
    return { type: 'ok', value: true };
  },
  
  getShare(propertyId, owner) {
    const shareKey = `${propertyId}-${owner}`;
    return this.ownershipShares.get(shareKey) || null;
  },
  
  getExpense(propertyId, expenseId) {
    const expenseKey = `${propertyId}-${expenseId}`;
    return this.expenses.get(expenseKey) || null;
  },
  
  getAllocation(propertyId, expenseId, owner) {
    const allocationKey = `${propertyId}-${expenseId}-${owner}`;
    return this.paymentAllocations.get(allocationKey) || null;
  }
};

describe('Expense Allocation Contract', () => {
  beforeEach(() => {
    // Reset the mock state before each test
    mockExpenseAllocation.ownershipShares.clear();
    mockExpenseAllocation.expenses.clear();
    mockExpenseAllocation.paymentAllocations.clear();
  });
  
  it('should register ownership shares', () => {
    const owner = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const propertyId = 1;
    const percentage = 75;
    
    const result = mockExpenseAllocation.registerShare(owner, propertyId, owner, percentage);
    expect(result.type).toBe('ok');
    
    const share = mockExpenseAllocation.getShare(propertyId, owner);
    expect(share).not.toBeNull();
    expect(share.percentage).toBe(percentage);
  });
  
  it('should not register shares with invalid percentage', () => {
    const owner = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const propertyId = 1;
    const invalidPercentage = 101;
    
    const result = mockExpenseAllocation.registerShare(owner, propertyId, owner, invalidPercentage);
    expect(result.type).toBe('err');
    expect(result.value).toBe(4); // ERR_INVALID_PERCENTAGE
  });
  
  it('should record an expense', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const propertyId = 1;
    const expenseId = 1;
    const description = 'Roof repair';
    const amount = 5000;
    const category = 'Maintenance';
    
    const result = mockExpenseAllocation.recordExpense(
        sender,
        propertyId,
        expenseId,
        description,
        amount,
        category
    );
    
    expect(result.type).toBe('ok');
    
    const expense = mockExpenseAllocation.getExpense(propertyId, expenseId);
    expect(expense).not.toBeNull();
    expect(expense.description).toBe(description);
    expect(expense.amount).toBe(amount);
    expect(expense.category).toBe(category);
    expect(expense.paidBy).toBe(sender);
    expect(expense.distributed).toBe(false);
  });
  
  it('should distribute an expense', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const propertyId = 1;
    const expenseId = 1;
    
    // Record the expense first
    mockExpenseAllocation.recordExpense(
        sender,
        propertyId,
        expenseId,
        'Roof repair',
        5000,
        'Maintenance'
    );
    
    // Distribute the expense
    const result = mockExpenseAllocation.distributeExpense(sender, propertyId, expenseId);
    expect(result.type).toBe('ok');
    
    const expense = mockExpenseAllocation.getExpense(propertyId, expenseId);
    expect(expense.distributed).toBe(true);
  });
  
  it('should allocate an expense to an owner', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const owner = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const propertyId = 1;
    const expenseId = 1;
    const percentage = 25;
    const amount = 5000;
    
    // Register ownership share
    mockExpenseAllocation.registerShare(owner, propertyId, owner, percentage);
    
    // Record and distribute the expense
    mockExpenseAllocation.recordExpense(
        sender,
        propertyId,
        expenseId,
        'Roof repair',
        amount,
        'Maintenance'
    );
    mockExpenseAllocation.distributeExpense(sender, propertyId, expenseId);
    
    // Allocate the expense
    const result = mockExpenseAllocation.allocateExpense(sender, propertyId, expenseId, owner);
    expect(result.type).toBe('ok');
    expect(result.value).toBe(Math.floor((amount * percentage) / 100));
    
    const allocation = mockExpenseAllocation.getAllocation(propertyId, expenseId, owner);
    expect(allocation).not.toBeNull();
    expect(allocation.amountDue).toBe(Math.floor((amount * percentage) / 100));
    expect(allocation.paid).toBe(false);
  });
  
  it('should record a payment for an allocated expense', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const owner = sender;
    const propertyId = 1;
    const expenseId = 1;
    
    // Register ownership share
    mockExpenseAllocation.registerShare(owner, propertyId, owner, 50);
    
    // Record and distribute the expense
    mockExpenseAllocation.recordExpense(
        sender,
        propertyId,
        expenseId,
        'Roof repair',
        5000,
        'Maintenance'
    );
    mockExpenseAllocation.distributeExpense(sender, propertyId, expenseId);
    
    // Allocate the expense
    mockExpenseAllocation.allocateExpense(sender, propertyId, expenseId, owner);
    
    // Record the payment
    const result = mockExpenseAllocation.recordPayment(owner, propertyId, expenseId);
    expect(result.type).toBe('ok');
    
    const allocation = mockExpenseAllocation.getAllocation(propertyId, expenseId, owner);
    expect(allocation.paid).toBe(true);
    expect(allocation.paymentDate).not.toBeNull();
  });
});
