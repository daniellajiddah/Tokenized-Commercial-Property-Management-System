;; Expense Allocation Contract
;; This contract distributes costs among property owners

(define-data-var contract-owner principal tx-sender)

;; Property ownership shares
(define-map ownership-shares
  { property-id: uint, owner: principal }
  {
    percentage: uint,
    last-updated: uint
  }
)

;; Expense records
(define-map expenses
  { property-id: uint, expense-id: uint }
  {
    description: (string-utf8 200),
    amount: uint,
    date: uint,
    category: (string-utf8 50),
    paid-by: principal,
    distributed: bool
  }
)

;; Payment allocations
(define-map payment-allocations
  { property-id: uint, expense-id: uint, owner: principal }
  {
    amount-due: uint,
    paid: bool,
    payment-date: (optional uint)
  }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_EXISTS u2)
(define-constant ERR_NOT_FOUND u3)
(define-constant ERR_INVALID_PERCENTAGE u4)
(define-constant ERR_ALREADY_DISTRIBUTED u5)

;; Initialize contract
(define-public (initialize (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (var-set contract-owner new-owner)
    (ok true)
  )
)

;; Register ownership share
(define-public (register-share
    (property-id uint)
    (owner principal)
    (percentage uint))
  (begin
    (asserts! (or (is-eq tx-sender (var-get contract-owner)) (is-eq tx-sender owner)) (err ERR_UNAUTHORIZED))
    (asserts! (<= percentage u100) (err ERR_INVALID_PERCENTAGE))

    (map-set ownership-shares
      { property-id: property-id, owner: owner }
      {
        percentage: percentage,
        last-updated: block-height
      }
    )
    (ok true)
  )
)

;; Record an expense
(define-public (record-expense
    (property-id uint)
    (expense-id uint)
    (description (string-utf8 200))
    (amount uint)
    (category (string-utf8 50)))
  (begin
    (asserts! (is-none (map-get? expenses { property-id: property-id, expense-id: expense-id })) (err ERR_ALREADY_EXISTS))

    (map-set expenses
      { property-id: property-id, expense-id: expense-id }
      {
        description: description,
        amount: amount,
        date: block-height,
        category: category,
        paid-by: tx-sender,
        distributed: false
      }
    )
    (ok true)
  )
)

;; Distribute an expense among owners
(define-public (distribute-expense (property-id uint) (expense-id uint))
  (let ((expense (unwrap! (map-get? expenses { property-id: property-id, expense-id: expense-id }) (err ERR_NOT_FOUND))))
    (asserts! (not (get distributed expense)) (err ERR_ALREADY_DISTRIBUTED))

    ;; Update expense to mark as distributed
    (map-set expenses
      { property-id: property-id, expense-id: expense-id }
      (merge expense { distributed: true })
    )

    (ok true)
  )
)

;; Calculate and allocate expense for a specific owner
(define-public (allocate-expense
    (property-id uint)
    (expense-id uint)
    (owner principal))
  (let (
    (expense (unwrap! (map-get? expenses { property-id: property-id, expense-id: expense-id }) (err ERR_NOT_FOUND)))
    (share (unwrap! (map-get? ownership-shares { property-id: property-id, owner: owner }) (err ERR_NOT_FOUND)))
    (amount-due (/ (* (get amount expense) (get percentage share)) u100))
  )
    (asserts! (get distributed expense) (err ERR_ALREADY_DISTRIBUTED))

    (map-set payment-allocations
      { property-id: property-id, expense-id: expense-id, owner: owner }
      {
        amount-due: amount-due,
        paid: false,
        payment-date: none
      }
    )
    (ok amount-due)
  )
)

;; Record a payment for an allocated expense
(define-public (record-payment (property-id uint) (expense-id uint))
  (let (
    (allocation (unwrap! (map-get? payment-allocations
                          { property-id: property-id, expense-id: expense-id, owner: tx-sender })
                        (err ERR_NOT_FOUND)))
  )
    (asserts! (not (get paid allocation)) (err u6))

    (map-set payment-allocations
      { property-id: property-id, expense-id: expense-id, owner: tx-sender }
      {
        amount-due: (get amount-due allocation),
        paid: true,
        payment-date: (some block-height)
      }
    )
    (ok true)
  )
)

;; Get ownership share
(define-read-only (get-share (property-id uint) (owner principal))
  (map-get? ownership-shares { property-id: property-id, owner: owner })
)

;; Get expense details
(define-read-only (get-expense (property-id uint) (expense-id uint))
  (map-get? expenses { property-id: property-id, expense-id: expense-id })
)

;; Get payment allocation
(define-read-only (get-allocation (property-id uint) (expense-id uint) (owner principal))
  (map-get? payment-allocations { property-id: property-id, expense-id: expense-id, owner: owner })
)

;; Get total expenses for a property
(define-read-only (get-total-expenses (property-id uint))
  (ok u0) ;; This would require iteration which is not directly supported in Clarity
)
