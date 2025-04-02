;; Tenant Management Contract
;; This contract handles lease agreements and terms

(define-data-var contract-owner principal tx-sender)

;; Lease structure
(define-map leases
  { property-id: uint, tenant-id: uint }
  {
    tenant: principal,
    start-date: uint,
    end-date: uint,
    monthly-rent: uint,
    security-deposit: uint,
    active: bool,
    terms: (string-utf8 1000)
  }
)

;; Rent payments tracking
(define-map rent-payments
  { property-id: uint, tenant-id: uint, payment-id: uint }
  {
    amount: uint,
    timestamp: uint,
    late: bool
  }
)

;; Tenant registry
(define-map tenants
  { tenant-id: uint }
  {
    address: principal,
    name: (string-utf8 100),
    contact: (string-utf8 100),
    rating: uint
  }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_EXISTS u2)
(define-constant ERR_NOT_FOUND u3)
(define-constant ERR_INVALID_DATE u4)
(define-constant ERR_LEASE_INACTIVE u5)

;; Initialize contract
(define-public (initialize (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (var-set contract-owner new-owner)
    (ok true)
  )
)

;; Register a new tenant
(define-public (register-tenant
    (tenant-id uint)
    (name (string-utf8 100))
    (contact (string-utf8 100)))
  (begin
    (asserts! (is-none (map-get? tenants { tenant-id: tenant-id })) (err ERR_ALREADY_EXISTS))
    (map-set tenants
      { tenant-id: tenant-id }
      {
        address: tx-sender,
        name: name,
        contact: contact,
        rating: u5
      }
    )
    (ok true)
  )
)

;; Create a new lease
(define-public (create-lease
    (property-id uint)
    (tenant-id uint)
    (start-date uint)
    (end-date uint)
    (monthly-rent uint)
    (security-deposit uint)
    (terms (string-utf8 1000)))
  (begin
    (asserts! (is-none (map-get? leases { property-id: property-id, tenant-id: tenant-id })) (err ERR_ALREADY_EXISTS))
    (asserts! (> end-date start-date) (err ERR_INVALID_DATE))

    (map-set leases
      { property-id: property-id, tenant-id: tenant-id }
      {
        tenant: (get address (unwrap! (map-get? tenants { tenant-id: tenant-id }) (err ERR_NOT_FOUND))),
        start-date: start-date,
        end-date: end-date,
        monthly-rent: monthly-rent,
        security-deposit: security-deposit,
        active: true,
        terms: terms
      }
    )
    (ok true)
  )
)

;; Record a rent payment
(define-public (record-payment
    (property-id uint)
    (tenant-id uint)
    (payment-id uint)
    (amount uint))
  (let (
    (lease (unwrap! (map-get? leases { property-id: property-id, tenant-id: tenant-id }) (err ERR_NOT_FOUND)))
    (current-time block-height)
  )
    (asserts! (get active lease) (err ERR_LEASE_INACTIVE))

    (map-set rent-payments
      { property-id: property-id, tenant-id: tenant-id, payment-id: payment-id }
      {
        amount: amount,
        timestamp: current-time,
        late: false
      }
    )
    (ok true)
  )
)

;; Terminate a lease
(define-public (terminate-lease (property-id uint) (tenant-id uint))
  (let ((lease (unwrap! (map-get? leases { property-id: property-id, tenant-id: tenant-id }) (err ERR_NOT_FOUND))))
    (asserts! (get active lease) (err ERR_LEASE_INACTIVE))

    (map-set leases
      { property-id: property-id, tenant-id: tenant-id }
      (merge lease { active: false })
    )
    (ok true)
  )
)

;; Get lease details
(define-read-only (get-lease (property-id uint) (tenant-id uint))
  (map-get? leases { property-id: property-id, tenant-id: tenant-id })
)

;; Get tenant details
(define-read-only (get-tenant (tenant-id uint))
  (map-get? tenants { tenant-id: tenant-id })
)

;; Get payment history
(define-read-only (get-payment (property-id uint) (tenant-id uint) (payment-id uint))
  (map-get? rent-payments { property-id: property-id, tenant-id: tenant-id, payment-id: payment-id })
)

;; Update tenant rating
(define-public (update-tenant-rating (tenant-id uint) (new-rating uint))
  (let ((tenant (unwrap! (map-get? tenants { tenant-id: tenant-id }) (err ERR_NOT_FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (asserts! (<= new-rating u10) (err ERR_INVALID_DATE))

    (map-set tenants
      { tenant-id: tenant-id }
      (merge tenant { rating: new-rating })
    )
    (ok true)
  )
)
