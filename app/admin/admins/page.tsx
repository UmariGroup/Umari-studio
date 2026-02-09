'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Admin {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

export default function AdminManagementPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [createForm, setCreateForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    void fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/create-admin');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Adminlarni yuklab bo\'lmadi');
        return;
      }

      setAdmins(data.data);
      setError('');
    } catch (err) {
      setError('Adminlarni yuklashda xatolik');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Admin yaratib bo\'lmadi');
        return;
      }

      setSuccess(`Admin ${createForm.email} muvaffaqiyatli yaratildi!`);
      setCreateForm({ email: '', firstName: '', lastName: '', password: '' });
      setShowCreateForm(false);
      void fetchAdmins();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Admin yaratishda xatolik');
      console.error(err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Parollar mos kelmadi');
      return;
    }

    try {
      const response = await fetch('/api/admin/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Parolni almashtirib bo\'lmadi');
        return;
      }

      setSuccess('Parol muvaffaqiyatli yangilandi!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Parolni yangilashda xatolik');
      console.error(err);
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminEmail: string) => {
    if (!confirm(`Rostdan ham ${adminEmail} adminini o'chirmoqchimisiz?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/delete-admin?id=${adminId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Adminni o\'chirib bo\'lmadi');
        return;
      }

      setSuccess('Admin muvaffaqiyatli o\'chirildi!');
      void fetchAdmins();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Adminni o\'chirishda xatolik');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">Admin boshqaruvi</h1>
          <p className="text-gray-400">Administrator akkauntlari va huquqlarini boshqaring</p>
        </div>

        {error ? (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-900/50 p-4">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 rounded-lg border border-green-700 bg-green-900/50 p-4">
            {success}
          </div>
        ) : null}

        <div className="mb-8 flex gap-4">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-lg bg-blue-600 px-6 py-2 font-semibold hover:bg-blue-700"
          >
            Yangi admin qo'shish
          </button>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="rounded-lg bg-yellow-600 px-6 py-2 font-semibold hover:bg-yellow-700"
          >
            Parolni almashtirish
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="rounded-lg bg-gray-700 px-6 py-2 font-semibold hover:bg-gray-600"
          >
            Orqaga
          </button>
        </div>

        {showCreateForm ? (
          <div className="mb-8 rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="mb-4 text-2xl font-bold">Yangi admin yaratish</h2>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white"
                  placeholder="admin@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Ism</label>
                  <input
                    type="text"
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white"
                    placeholder="Ism"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Familiya</label>
                  <input
                    type="text"
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white"
                    placeholder="Familiya"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Parol (kamida 6 ta belgi)</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white"
                  placeholder="Yangi parol"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-green-600 px-6 py-2 font-semibold hover:bg-green-700"
                >
                  Admin yaratish
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 rounded-lg bg-gray-600 px-6 py-2 font-semibold hover:bg-gray-700"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {showPasswordForm ? (
          <div className="mb-8 rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="mb-4 text-2xl font-bold">Parolni almashtirish</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Joriy parol</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white"
                  placeholder="Joriy parol"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Yangi parol</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white"
                    placeholder="Yangi parol"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Parolni tasdiqlang</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white"
                    placeholder="Parolni tasdiqlang"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-yellow-600 px-6 py-2 font-semibold hover:bg-yellow-700"
                >
                  Parolni yangilash
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(false)}
                  className="flex-1 rounded-lg bg-gray-600 px-6 py-2 font-semibold hover:bg-gray-700"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
          <div className="border-b border-gray-700 p-6">
            <h2 className="text-2xl font-bold">Barcha adminlar ({loading ? '...' : admins.length})</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-400">Adminlar yuklanmoqda...</div>
          ) : admins.length === 0 ? (
            <div className="p-6 text-center text-gray-400">Adminlar topilmadi</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Ism</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Yaratilgan sana</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4">{admin.email}</td>
                      <td className="px-6 py-4">{admin.first_name} {admin.last_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(admin.created_at).toLocaleDateString('uz-UZ')}
                      </td>
                      <td className="px-6 py-4">
                        {admins.length > 1 ? (
                          <button
                            onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                            className="font-semibold text-red-400 hover:text-red-300"
                          >
                            O'chirish
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-lg border border-blue-700 bg-blue-900/30 p-6">
          <h3 className="mb-3 font-bold">Xavfsizlik eslatmalari:</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• Barcha parollar `bcrypt` (12 rounds) bilan xeshlanadi</li>
            <li>• Kamida bitta admin doim bo'lishi shart (oxirgi adminni o'chirib bo'lmaydi)</li>
            <li>• Barcha admin amallari audit jurnaliga yoziladi</li>
            <li>• Parol almashishda joriy parol tekshiriladi</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
