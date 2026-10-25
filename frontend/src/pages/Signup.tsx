import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MAX_DESCRIPTIVE_TEXT_LENGTH } from '../constants';

const emptyMember = { name: '', email: '', phone: '', address: '' };

export const Signup: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '', confirmPassword: '', role: 'USER' });
  const [teamName, setTeamName] = useState('');
  const [teamAddress, setTeamAddress] = useState('');
  const [members, setMembers] = useState([emptyMember]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{10}$/.test(form.phone)) return setError('Phone number must contain exactly 10 digits');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Please provide a valid email address');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.role === 'COLLECTOR') {
      const memberEmails = members.map((member) => member.email.trim().toLowerCase());
      const memberPhones = members.map((member) => member.phone);
      if (!teamName.trim() || !teamAddress.trim() || members.some((member) => !member.name.trim() || !member.address.trim() || !/^\d{10}$/.test(member.phone) || !/^\S+@\S+\.\S+$/.test(member.email.trim()))) {
        return setError('Complete every team member with a valid email and exactly 10-digit phone number');
      }
      if (new Set(memberEmails).size !== memberEmails.length) return setError('Team member email addresses must be different');
      if (new Set(memberPhones).size !== memberPhones.length) return setError('Team member phone numbers must be different');
      if (memberEmails.includes(form.email.trim().toLowerCase())) return setError('Team leader email must be different from member emails');
      if (memberPhones.includes(form.phone)) return setError('Team leader phone must be different from member phones');
    }
    setLoading(true);
    try {
      const response = await register({ ...form, teamName, teamAddress, members });
      const message = form.role === 'ADMIN'
        ? (response?.message || 'Registration successful. Your Admin account is pending approval from the Primary Admin.')
        : 'Account created successfully. Redirecting to login...';
      setSuccess(message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4 py-8">
    <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
      <h1 className="text-3xl font-bold text-green-600 text-center">SwachhDoot</h1>
      <p className="text-gray-600 text-center mb-6">Create a secure account</p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {(['name', 'email', 'phone'] as const).map((field) => <label key={field} className="text-sm font-medium text-gray-700">{field === 'name' ? 'Full Name' : field[0].toUpperCase() + field.slice(1)}
            <input type={field === 'email' ? 'email' : 'text'} value={form[field]} onChange={(e) => update(field, e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg" required />
          </label>)}
        </div>
        <label className="text-sm font-medium text-gray-700">Address<textarea value={form.address} onChange={(e) => update('address', e.target.value.slice(0, MAX_DESCRIPTIVE_TEXT_LENGTH))} maxLength={MAX_DESCRIPTIVE_TEXT_LENGTH} rows={2} className="w-full mt-1 px-4 py-2 border rounded-lg" required /><span className="block mt-1 text-right text-xs text-gray-500">{form.address.length}/{MAX_DESCRIPTIVE_TEXT_LENGTH}</span></label>
        <label className="text-sm font-medium text-gray-700">Account Type<select value={form.role} onChange={(e) => update('role', e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg"><option value="USER">Citizen / Consumer</option><option value="COLLECTOR">Waste Management Team</option><option value="ADMIN">Admin (approval required)</option></select></label>
        {form.role === 'COLLECTOR' && <div className="border rounded-lg p-4 space-y-3"><h2 className="font-semibold">Team details</h2><input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required /><div><input placeholder="Team address" value={teamAddress} onChange={(e) => setTeamAddress(e.target.value.slice(0, MAX_DESCRIPTIVE_TEXT_LENGTH))} maxLength={MAX_DESCRIPTIVE_TEXT_LENGTH} className="w-full px-4 py-2 border rounded-lg" required /><div className="mt-1 text-right text-xs text-gray-500">{teamAddress.length}/{MAX_DESCRIPTIVE_TEXT_LENGTH}</div></div><label className="block text-sm font-medium text-gray-700">Number of team members<select value={members.length} onChange={(e) => setMembers(Array.from({ length: Number(e.target.value) }, (_, index) => members[index] || { ...emptyMember }))} className="w-full mt-1 px-4 py-2 border rounded-lg">{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} member{count > 1 ? 's' : ''}</option>)}</select></label>{members.map((member, index) => <div key={index} className="grid md:grid-cols-2 gap-2 border-t pt-3"><input placeholder={`Member ${index + 1} full name`} value={member.name} onChange={(e) => setMembers(members.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="px-3 py-2 border rounded-lg" required /><input type="email" placeholder="Member email" value={member.email} onChange={(e) => setMembers(members.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} className="px-3 py-2 border rounded-lg" required /><input inputMode="numeric" maxLength={10} placeholder="10-digit phone" value={member.phone} onChange={(e) => setMembers(members.map((item, i) => i === index ? { ...item, phone: e.target.value.replace(/\D/g, '').slice(0, 10) } : item))} className="px-3 py-2 border rounded-lg" required /><div><input placeholder="Member address" value={member.address} onChange={(e) => setMembers(members.map((item, i) => i === index ? { ...item, address: e.target.value.slice(0, MAX_DESCRIPTIVE_TEXT_LENGTH) } : item))} maxLength={MAX_DESCRIPTIVE_TEXT_LENGTH} className="px-3 py-2 border rounded-lg" required /><div className="mt-1 text-right text-xs text-gray-500">{member.address.length}/{MAX_DESCRIPTIVE_TEXT_LENGTH}</div></div></div>)}</div>}
        <div className="grid md:grid-cols-2 gap-4"><input type="password" placeholder="Password" value={form.password} onChange={(e) => update('password', e.target.value)} className="px-4 py-2 border rounded-lg" required /><input type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} className="px-4 py-2 border rounded-lg" required /></div>
        <button disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">{loading ? 'Creating account...' : 'Sign Up'}</button>
      </form>
      <p className="mt-4 text-center text-gray-600">Already have an account? <button onClick={() => navigate('/login')} className="text-green-600 font-medium">Login</button></p>
    </div>
  </div>;
};
