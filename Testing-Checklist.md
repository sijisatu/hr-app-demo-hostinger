# HR App Testing Checklist

## Purpose

Manual testing checklist for pre-production validation of the HR App.  
Use this checklist for:

- smoke test after deployment
- regression test before release
- UAT / business sign-off
- final production readiness review

## Test Preparation

- [ ] Use latest build and latest database migration state
- [ ] Confirm backend is connected to PostgreSQL
- [ ] Confirm required seed/demo users exist for all roles
- [ ] Confirm file storage path is writable
- [ ] Confirm test browser cache is cleared or use incognito
- [ ] Confirm test data can be safely created and deleted
- [ ] Prepare at least these accounts:
  - [ ] Admin
  - [ ] HR
  - [ ] Manager
  - [ ] Employee
- [ ] Prepare sample employee records with:
  - [ ] active employee
  - [ ] inactive employee
  - [ ] employee with payroll data
  - [ ] employee with leave balance
  - [ ] employee with attendance history
- [ ] Prepare sample files for upload:
  - [ ] image
  - [ ] PDF
  - [ ] invalid file type
  - [ ] large file

## Suggested Test Evidence

- [ ] Screenshot for each critical flow
- [ ] Record browser + backend errors if any
- [ ] Note exact user role used
- [ ] Note exact steps to reproduce any bug
- [ ] Note expected result vs actual result

## Release Blocking Areas

- [ ] Login works for all intended roles
- [ ] Session/role access is correct
- [ ] Employee CRUD works
- [ ] Attendance check-in / check-out works
- [ ] Leave submission and approval works
- [ ] Payroll page loads and core records are correct
- [ ] Reimbursement submission works
- [ ] Dashboard loads without broken widgets
- [ ] No sensitive data leaks in UI or API responses
- [ ] No major console errors
- [ ] No backend 500 errors on core flows

---

## 1. Authentication And Session

### Login

- [ ] Login page loads correctly on desktop
- [ ] Login page loads correctly on mobile viewport
- [ ] Valid admin login succeeds
- [ ] Valid HR login succeeds
- [ ] Valid manager login succeeds
- [ ] Valid employee login succeeds
- [ ] Invalid password shows proper error
- [ ] Unknown user shows proper error
- [ ] Empty form validation works
- [ ] Trimming/spacing in credentials does not break login unexpectedly
- [ ] Password field masks input correctly
- [ ] Enter key submits form correctly

### Session

- [ ] User lands on correct default page after login
- [ ] Session persists after page refresh
- [ ] Protected page cannot be accessed without login
- [ ] Logged-out user is redirected to login page
- [ ] Logout works from sidebar/logout button
- [ ] Switching account works correctly

### Role-Based Access

- [ ] Admin sees only allowed menus
- [ ] HR sees only allowed menus
- [ ] Manager sees only allowed menus
- [ ] Employee sees only allowed menus
- [ ] Direct URL access to unauthorized page is blocked
- [ ] Unauthorized API actions are blocked

---

## 2. Navigation And Layout

### General Navigation

- [ ] Sidebar loads correctly
- [ ] Sidebar collapsed state is usable
- [ ] Sidebar expanded state is usable
- [ ] Active menu highlight is correct
- [ ] Profile chip redirects to profile page
- [ ] Search box in topbar renders correctly
- [ ] Header actions render correctly
- [ ] No menu text overflow or clipping
- [ ] No broken layout during hover/expand

### Responsive Layout

- [ ] Dashboard layout works on desktop
- [ ] Dashboard layout works on tablet width
- [ ] Dashboard layout works on mobile width
- [ ] Mobile bottom navigation works for employee/manager flows
- [ ] Mobile sidebar open/close works
- [ ] No content hidden behind fixed nav/buttons

### UI Stability

- [ ] No layout jump on page transitions
- [ ] No visual overlap between sidebar and content
- [ ] No horizontal scroll on core pages
- [ ] Empty states look acceptable
- [ ] Long names and long labels do not break layout

---

## 3. Dashboard

### Core Rendering

- [ ] Dashboard loads without error
- [ ] KPI cards show values
- [ ] Charts render correctly
- [ ] Activity/history panel renders correctly
- [ ] HR dashboard widgets load correctly
- [ ] Employee dashboard widgets load correctly
- [ ] Manager dashboard behaves as expected

### Data Accuracy

- [ ] Employee count is correct
- [ ] On-time / late / absent counts are correct
- [ ] Pending leave count is correct
- [ ] HR insights numbers match backend data
- [ ] Workforce panels show correct employee data
- [ ] Latest activity reflects latest records

### Edge Cases

- [ ] Dashboard handles zero data state
- [ ] Dashboard handles large data set without broken layout
- [ ] Dashboard still works if one widget has empty data

---

## 4. Employee Management

### Employee List

- [ ] Employee list page loads
- [ ] Table data renders correctly
- [ ] Search/filter works if available
- [ ] Pagination/scroll works if available
- [ ] Employee detail links open correctly

### Add Employee

- [ ] Add employee form opens
- [ ] Required field validation works
- [ ] Employee can be saved with valid minimal data
- [ ] Employee can be saved with full data
- [ ] Duplicate unique fields are rejected properly
- [ ] Invalid email/phone/input formats are handled properly
- [ ] Add button is visible and usable

### Edit Employee

- [ ] Existing employee can be edited
- [ ] Changed values persist after refresh
- [ ] Financial detail updates persist correctly
- [ ] Contract/department/role updates persist correctly

### Documents

- [ ] Employee document upload works
- [ ] Uploaded document can be viewed/downloaded if expected
- [ ] Invalid file type is rejected properly
- [ ] Large file handling is acceptable

### Data Integrity

- [ ] Employee list reflects new employee immediately or after refresh
- [ ] Deactivated/inactive employee status displays correctly
- [ ] Sensitive fields are not exposed unnecessarily

---

## 5. Attendance

### Attendance Main Page

- [ ] Attendance page loads
- [ ] Employee attendance summary renders
- [ ] Team report page loads
- [ ] Attendance records/history are correct

### Check-In / Check-Out

- [ ] Clock In button opens flow correctly
- [ ] Clock In creates attendance record
- [ ] Clock Out updates open attendance record
- [ ] Button label switches correctly between Clock In and Clock Out
- [ ] Multiple open sessions are prevented
- [ ] Check-in timestamp is correct
- [ ] Check-out timestamp is correct

### Validation

- [ ] GPS validation works if enabled
- [ ] Selfie capture/upload works if enabled
- [ ] Failed GPS/selfie flow shows proper error
- [ ] Attendance cannot be submitted with invalid state

### Attendance Sub-Modules

- [ ] Leave request page loads
- [ ] Sick submission page loads
- [ ] Half-day request page loads
- [ ] On-duty request page loads
- [ ] Submit overtime page loads
- [ ] Leave balance page loads
- [ ] Team report page loads for allowed roles only

### Attendance Accuracy

- [ ] Attendance status calculations are correct
- [ ] Overtime submissions are stored correctly
- [ ] Leave balance values update correctly after leave actions
- [ ] Employee can only see own records where appropriate
- [ ] HR/Admin can see organization/team records where appropriate

---

## 6. Leave And Approval

### Submission

- [ ] Employee can create leave request
- [ ] Employee can create sick submission
- [ ] Employee can create half-day request
- [ ] Employee can create on-duty request
- [ ] Request validation works for missing required fields
- [ ] Invalid date ranges are rejected
- [ ] Leave balance is shown correctly

### Approval Workflow

- [ ] HR/authorized role can review requests
- [ ] Approve action works
- [ ] Reject action works
- [ ] Request status updates correctly in UI
- [ ] Approved request affects balance correctly
- [ ] Rejected request does not reduce balance

### Edge Cases

- [ ] Overlapping leave request behavior is correct
- [ ] Zero/insufficient balance behavior is correct
- [ ] Large notes/comments do not break layout

---

## 7. Reimbursement

### Submission

- [ ] Reimbursement page loads
- [ ] User can add reimbursement request
- [ ] Receipt amount formatting works correctly
- [ ] Claim type selection works
- [ ] Receipt/document upload works
- [ ] Required field validation works

### Reimbursement Types

- [ ] Medical reimbursement flow works
- [ ] Other reimbursement flow works
- [ ] Receipt preview/reference is correct if available

### Data And Status

- [ ] Reimbursement list/history renders correctly
- [ ] Newly submitted request appears correctly
- [ ] Status changes are reflected correctly

---

## 8. Payroll

### Payroll Main Page

- [ ] Payroll page loads for allowed roles
- [ ] Restricted roles cannot access hidden payroll data if not allowed
- [ ] Payroll values render correctly
- [ ] Payroll table/cards do not break layout

### Payroll Data Accuracy

- [ ] Base salary is correct
- [ ] Allowances are correct
- [ ] Deductions are correct
- [ ] Gross/net values are correct
- [ ] Attendance impact on payroll is correct if implemented
- [ ] Tax values are correct based on current app rules

### Payslip

- [ ] Payslip/history page or section loads
- [ ] Payslip can be opened/downloaded if available
- [ ] Generated file opens properly
- [ ] Correct employee sees correct payslip only

---

## 9. Profile

### Employee Profile

- [ ] Profile page loads
- [ ] User sees correct own profile data
- [ ] Work profile fields render correctly
- [ ] Compensation/financial data visibility matches role rules
- [ ] Profile chip in sidebar navigates correctly

### Data Quality

- [ ] Long names do not break layout
- [ ] Missing optional fields are handled gracefully
- [ ] Profile data matches employee master data

---

## 10. Reports

- [ ] Reports page loads for allowed roles
- [ ] Attendance report loads correctly
- [ ] Employee list report loads correctly
- [ ] Payroll report loads correctly if enabled
- [ ] Filters work correctly
- [ ] Export/download works if available
- [ ] Exported file format opens correctly
- [ ] Report totals match source data

---

## 11. API And Data Persistence

### Persistence

- [ ] New records persist after page refresh
- [ ] New records persist after app restart
- [ ] Edits persist correctly
- [ ] Uploaded files remain accessible after refresh/restart

### API Quality

- [ ] No obvious 4xx/5xx errors during normal flows
- [ ] Validation errors return meaningful messages
- [ ] No sensitive fields exposed in API responses
- [ ] Session/user lookup API works correctly

### Database

- [ ] App starts successfully with database mode enabled
- [ ] Health/readiness status shows database connected
- [ ] No obvious duplicate/orphaned records from core flows
- [ ] Concurrent updates do not obviously corrupt data

---

## 12. Security And Permissions

- [ ] Unauthorized user cannot access restricted page by URL
- [ ] Unauthorized role cannot see hidden navigation items
- [ ] Unauthorized role cannot submit restricted action
- [ ] Login errors do not leak sensitive details
- [ ] Sensitive employee financial data is only visible to proper roles
- [ ] Hidden password/login fields are not exposed in employee API list
- [ ] File uploads do not allow obviously unsafe file handling

---

## 13. Error Handling And Edge Cases

- [ ] Empty data states display gracefully
- [ ] Invalid form submission shows clear message
- [ ] API/network failure shows recoverable UX
- [ ] Retry works after temporary failure
- [ ] Duplicate submission prevention works on buttons/forms
- [ ] Refresh during form flow does not corrupt data
- [ ] Browser back/forward behavior is acceptable

---

## 14. Performance And Stability

- [ ] Login response feels acceptable
- [ ] Dashboard first load feels acceptable
- [ ] Employee list load feels acceptable
- [ ] Attendance page load feels acceptable
- [ ] No severe UI lag on page transitions
- [ ] No obvious memory leak or repeated requests on idle page
- [ ] Large table/list page remains usable

---

## 15. Browser And Device Coverage

### Desktop Browsers

- [ ] Chrome latest
- [ ] Edge latest
- [ ] Firefox latest

### Mobile / Responsive

- [ ] iPhone viewport
- [ ] Android viewport
- [ ] Tablet viewport

### Cross-Check

- [ ] Fonts render correctly
- [ ] Icons render correctly
- [ ] File upload works across target browsers
- [ ] Camera/selfie flow works on target devices if required

---

## 16. Final Pre-Production Sign-Off

- [ ] All critical flows pass
- [ ] All high severity bugs are fixed
- [ ] All medium severity bugs are accepted or fixed
- [ ] UAT stakeholders sign off
- [ ] Backup/restore procedure is validated
- [ ] Production env values are prepared
- [ ] Deployment plan is prepared
- [ ] Rollback plan is prepared
- [ ] Monitoring/log review plan is prepared

---

## Suggested Test Users Matrix

### Admin

- [ ] Login
- [ ] Dashboard
- [ ] Employee management
- [ ] Attendance visibility
- [ ] Reports
- [ ] Payroll visibility

### HR

- [ ] Login
- [ ] Dashboard
- [ ] Employee management
- [ ] Leave review
- [ ] Attendance team report
- [ ] Reports
- [ ] Payroll

### Manager

- [ ] Login
- [ ] Dashboard
- [ ] Personal attendance
- [ ] Personal payroll/profile
- [ ] Team/approval permissions if applicable

### Employee

- [ ] Login
- [ ] Dashboard
- [ ] Clock in / clock out
- [ ] Leave submission
- [ ] Overtime submission
- [ ] Reimbursement submission
- [ ] Profile
- [ ] Payroll / payslip access if applicable

---

## Bug Logging Template

Use this format for each issue found:

- ID:
- Title:
- Module:
- Role:
- Environment:
- Steps to reproduce:
- Expected result:
- Actual result:
- Severity:
- Screenshot / video:
- Backend/API error if any:

