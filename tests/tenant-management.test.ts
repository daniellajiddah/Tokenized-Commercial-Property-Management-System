import { describe, it, expect, beforeEach } from 'vitest';

// Mock implementation for testing the tenant management contract
const mockTenantManagement = {
  leases: new Map(),
  tenants: new Map(),
  rentPayments: new Map(),
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  
  registerTenant(sender, tenantId, name, contact) {
    if (this.tenants.has(tenantId)) {
      return { type: 'err', value: 2 }; // ERR_ALREADY_EXISTS
    }
    
    this.tenants.set(tenantId, {
      address: sender,
      name,
      contact,
      rating: 5
    });
    
    return { type: 'ok', value: true };
  },
  
  createLease(sender, propertyId, tenantId, startDate, endDate, monthlyRent, securityDeposit, terms) {
    const leaseKey = `${propertyId}-${tenantId}`;
    
    if (this.leases.has(leaseKey)) {
      return { type: 'err', value: 2 }; // ERR_ALREADY_EXISTS
    }
    
    if (endDate <= startDate) {
      return { type: 'err', value: 4 }; // ERR_INVALID_DATE
    }
    
    if (!this.tenants.has(tenantId)) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    const tenant = this.tenants.get(tenantId);
    
    this.leases.set(leaseKey, {
      tenant: tenant.address,
      startDate,
      endDate,
      monthlyRent,
      securityDeposit,
      active: true,
      terms
    });
    
    return { type: 'ok', value: true };
  },
  
  recordPayment(sender, propertyId, tenantId, paymentId, amount) {
    const leaseKey = `${propertyId}-${tenantId}`;
    const paymentKey = `${propertyId}-${tenantId}-${paymentId}`;
    
    if (!this.leases.has(leaseKey)) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    const lease = this.leases.get(leaseKey);
    if (!lease.active) {
      return { type: 'err', value: 5 }; // ERR_LEASE_INACTIVE
    }
    
    this.rentPayments.set(paymentKey, {
      amount,
      timestamp: Date.now(),
      late: false
    });
    
    return { type: 'ok', value: true };
  },
  
  terminateLease(sender, propertyId, tenantId) {
    const leaseKey = `${propertyId}-${tenantId}`;
    
    if (!this.leases.has(leaseKey)) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    const lease = this.leases.get(leaseKey);
    if (!lease.active) {
      return { type: 'err', value: 5 }; // ERR_LEASE_INACTIVE
    }
    
    lease.active = false;
    this.leases.set(leaseKey, lease);
    
    return { type: 'ok', value: true };
  },
  
  getLease(propertyId, tenantId) {
    const leaseKey = `${propertyId}-${tenantId}`;
    return this.leases.get(leaseKey) || null;
  },
  
  getTenant(tenantId) {
    return this.tenants.get(tenantId) || null;
  },
  
  getPayment(propertyId, tenantId, paymentId) {
    const paymentKey = `${propertyId}-${tenantId}-${paymentId}`;
    return this.rentPayments.get(paymentKey) || null;
  }
};

describe('Tenant Management Contract', () => {
  beforeEach(() => {
    // Reset the mock state before each test
    mockTenantManagement.leases.clear();
    mockTenantManagement.tenants.clear();
    mockTenantManagement.rentPayments.clear();
  });
  
  it('should register a new tenant', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const tenantId = 1;
    const name = 'John Doe';
    const contact = 'john@example.com';
    
    const result = mockTenantManagement.registerTenant(sender, tenantId, name, contact);
    expect(result.type).toBe('ok');
    
    const tenant = mockTenantManagement.getTenant(tenantId);
    expect(tenant).not.toBeNull();
    expect(tenant.address).toBe(sender);
    expect(tenant.name).toBe(name);
    expect(tenant.contact).toBe(contact);
    expect(tenant.rating).toBe(5);
  });
  
  it('should not register a tenant that already exists', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const tenantId = 1;
    
    // Register the tenant first
    mockTenantManagement.registerTenant(sender, tenantId, 'John Doe', 'john@example.com');
    
    // Try to register it again
    const result = mockTenantManagement.registerTenant(sender, tenantId, 'John Doe', 'john@example.com');
    expect(result.type).toBe('err');
    expect(result.value).toBe(2); // ERR_ALREADY_EXISTS
  });
  
  it('should create a new lease', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const tenantId = 1;
    const propertyId = 1;
    const startDate = Date.now();
    const endDate = startDate + 31536000000; // One year later
    
    // Register the tenant first
    mockTenantManagement.registerTenant(sender, tenantId, 'John Doe', 'john@example.com');
    
    // Create the lease
    const result = mockTenantManagement.createLease(
        sender,
        propertyId,
        tenantId,
        startDate,
        endDate,
        2000,
        4000,
        'Standard lease terms'
    );
    
    expect(result.type).toBe('ok');
    
    const lease = mockTenantManagement.getLease(propertyId, tenantId);
    expect(lease).not.toBeNull();
    expect(lease.tenant).toBe(sender);
    expect(lease.startDate).toBe(startDate);
    expect(lease.endDate).toBe(endDate);
    expect(lease.monthlyRent).toBe(2000);
    expect(lease.securityDeposit).toBe(4000);
    expect(lease.active).toBe(true);
  });
  
  it('should not create a lease with invalid dates', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const tenantId = 1;
    const propertyId = 1;
    const date = Date.now();
    
    // Register the tenant first
    mockTenantManagement.registerTenant(sender, tenantId, 'John Doe', 'john@example.com');
    
    // Try to create a lease with end date before start date
    const result = mockTenantManagement.createLease(
        sender,
        propertyId,
        tenantId,
        date,
        date - 1000, // End date before start date
        2000,
        4000,
        'Standard lease terms'
    );
    
    expect(result.type).toBe('err');
    expect(result.value).toBe(4); // ERR_INVALID_DATE
  });
  
  it('should record a rent payment', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const tenantId = 1;
    const propertyId = 1;
    const paymentId = 1;
    const startDate = Date.now();
    const endDate = startDate + 31536000000; // One year later
    
    // Register the tenant first
    mockTenantManagement.registerTenant(sender, tenantId, 'John Doe', 'john@example.com');
    
    // Create the lease
    mockTenantManagement.createLease(
        sender,
        propertyId,
        tenantId,
        startDate,
        endDate,
        2000,
        4000,
        'Standard lease terms'
    );
    
    // Record a payment
    const result = mockTenantManagement.recordPayment(sender, propertyId, tenantId, paymentId, 2000);
    expect(result.type).toBe('ok');
    
    const payment = mockTenantManagement.getPayment(propertyId, tenantId, paymentId);
    expect(payment).not.toBeNull();
    expect(payment.amount).toBe(2000);
    expect(payment.late).toBe(false);
  });
  
  it('should terminate a lease', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const tenantId = 1;
    const propertyId = 1;
    const startDate = Date.now();
    const endDate = startDate + 31536000000; // One year later
    
    // Register the tenant first
    mockTenantManagement.registerTenant(sender, tenantId, 'John Doe', 'john@example.com');
    
    // Create the lease
    mockTenantManagement.createLease(
        sender,
        propertyId,
        tenantId,
        startDate,
        endDate,
        2000,
        4000,
        'Standard lease terms'
    );
    
    // Terminate the lease
    const result = mockTenantManagement.terminateLease(sender, propertyId, tenantId);
    expect(result.type).toBe('ok');
    
    const lease = mockTenantManagement.getLease(propertyId, tenantId);
    expect(lease.active).toBe(false);
  });
});
