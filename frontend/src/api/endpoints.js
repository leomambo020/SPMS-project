// Typed endpoint helpers — thin wrappers over the raw api client so
// pages read cleanly and the API surface lives in one place.

import { api } from './client';

export const employeesApi = {
  list: (params) => api.get('/employees', params),
  get: (id) => api.get(`/employees/${id}`),
  create: (body) => api.post('/employees', body),
  update: (id, body) => api.patch(`/employees/${id}`, body),
  remove: (id) => api.delete(`/employees/${id}`),
};

export const departmentsApi = {
  list: () => api.get('/departments'),
  get: (id) => api.get(`/departments/${id}`),
  create: (body) => api.post('/departments', body),
  update: (id, body) => api.patch(`/departments/${id}`, body),
  remove: (id) => api.delete(`/departments/${id}`),
};

export const attendanceApi = {
  punch: (body) => api.post('/attendance', body),
  list: (params) => api.get('/attendance', params),
};

export const leaveApi = {
  apply: (body) => api.post('/leave', body),
  list: (params) => api.get('/leave', params),
  decide: (id, body) => api.patch(`/leave/${id}/decision`, body),
};

export const payrollApi = {
  process: (body) => api.post('/payroll', body),
  list: (params) => api.get('/payroll', params),
};

export const appraisalsApi = {
  submit: (body) => api.post('/appraisals', body),
  list: (params) => api.get('/appraisals', params),
};

export const reportsApi = {
  staffing: () => api.get('/reports/staffing'),
  attendance: (params) => api.get('/reports/attendance', params),
  leave: () => api.get('/reports/leave'),
  payroll: () => api.get('/reports/payroll'),
};