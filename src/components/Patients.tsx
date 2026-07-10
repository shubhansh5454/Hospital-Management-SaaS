import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Users, 
  Search, 
  Plus, 
  UserPlus, 
  ChevronRight, 
  Heart, 
  MapPin, 
  Activity, 
  Check, 
  AlertCircle 
} from 'lucide-react';

const patientFormSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please provide a valid email"),
  phone: z.string().min(6, "Phone must be at least 6 characters"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  gender: z.string().min(1, "Please select a gender"),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

export default function Patients() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // TanStack Query: Fetch Patients
  const { data: patients = [], isLoading, error } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to load clinic patients');
      }
      return res.json();
    },
    enabled: !!token
  });

  // react-hook-form setup
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      dob: '',
      gender: '',
      bloodGroup: '',
      address: '',
      medicalHistory: '',
    }
  });

  // TanStack Query Mutation: Register Patient
  const registerMutation = useMutation({
    mutationFn: async (values: PatientFormValues) => {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server rejected registration');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setSuccessMessage('Patient successfully registered in clinical directory!');
      setShowAddForm(false);
      reset();
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  });

  const onSubmit = (data: PatientFormValues) => {
    registerMutation.mutate(data);
  };

  // Filter patients
  const filteredPatients = patients.filter((patient: any) => {
    const term = searchTerm.toLowerCase();
    return (
      patient.name.toLowerCase().includes(term) ||
      patient.email.toLowerCase().includes(term) ||
      patient.phone.includes(term)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Banner / Header actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-base font-display font-bold text-slate-800">EHR Patient Directory</h3>
          <p className="text-xs text-slate-400">Manage electronic health files and diagnostic records</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-10 px-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
        >
          {showAddForm ? 'View Patients List' : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Register Patient</span>
            </>
          )}
        </button>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex gap-3 text-xs font-medium">
          <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {registerMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl flex gap-3 text-xs font-medium">
          <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
          <span>{registerMutation.error?.message || 'Failed to submit form.'}</span>
        </div>
      )}

      {showAddForm ? (
        /* Patient registration form */
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h4 className="text-sm font-display font-bold text-slate-800 border-b border-slate-50 pb-3 mb-5">
            Patient Demographics & Medical Folder
          </h4>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Full Name *</label>
                <input
                  {...register('name')}
                  type="text"
                  placeholder="e.g. John Doe"
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
                />
                {errors.name && <p className="text-[10px] text-red-500 font-medium">{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Email Address *</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="e.g. john@example.com"
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
                />
                {errors.email && <p className="text-[10px] text-red-500 font-medium">{errors.email.message}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Contact Phone *</label>
                <input
                  {...register('phone')}
                  type="text"
                  placeholder="e.g. +1 (555) 019-2834"
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
                />
                {errors.phone && <p className="text-[10px] text-red-500 font-medium">{errors.phone.message}</p>}
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Date of Birth (YYYY-MM-DD) *</label>
                <input
                  {...register('dob')}
                  type="text"
                  placeholder="e.g. 1990-05-15"
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
                />
                {errors.dob && <p className="text-[10px] text-red-500 font-medium">{errors.dob.message}</p>}
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Gender *</label>
                <select
                  {...register('gender')}
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all bg-white"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && <p className="text-[10px] text-red-500 font-medium">{errors.gender.message}</p>}
              </div>

              {/* Blood Group */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Blood Group</label>
                <select
                  {...register('bloodGroup')}
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all bg-white"
                >
                  <option value="">Unknown</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Home Address</label>
              <input
                {...register('address')}
                type="text"
                placeholder="e.g. 123 Health Ave, Suite 400"
                className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
              />
            </div>

            {/* Medical History */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Clinical Notes & Medical History</label>
              <textarea
                {...register('medicalHistory')}
                rows={3}
                placeholder="Allergies, chronic conditions, regular prescriptions, etc."
                className="w-full p-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-10 px-5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Register Patient Profile</span>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Patient list grid */
        <div className="space-y-4">
          
          {/* Search filter bar */}
          <div className="flex items-center gap-3 bg-white px-4 h-11 border border-slate-100 rounded-xl shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter patients by name, email, phone..."
              className="w-full h-full text-xs font-medium text-slate-700 bg-transparent focus:outline-none"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white border border-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center space-y-2">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-600">No patient files found</p>
              <p className="text-xs text-slate-400">
                {searchTerm ? 'Adjust your search filters' : 'Register your first patient using the register button.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-6">Name & Demographics</th>
                      <th className="py-3 px-6">Contact Details</th>
                      <th className="py-3 px-6">Date of Birth</th>
                      <th className="py-3 px-6 text-center">Blood</th>
                      <th className="py-3 px-6">Medical Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredPatients.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-teal-50 border border-teal-100/50 text-teal-600 rounded-lg flex items-center justify-center font-bold text-xs">
                              {p.name.substring(0,2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-slate-800 block">{p.name}</span>
                              <span className="text-[10px] text-slate-400 block capitalize">{p.gender}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-xs">
                          <span className="text-slate-700 block">{p.email}</span>
                          <span className="text-slate-400 text-[10px] block">{p.phone}</span>
                        </td>
                        <td className="py-4 px-6 text-xs font-semibold text-slate-600 font-mono">
                          {p.dob}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {p.bloodGroup ? (
                            <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-md text-[10px] font-bold">
                              {p.bloodGroup}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-500 max-w-xs truncate" title={p.medicalHistory}>
                          {p.medicalHistory || <span className="italic text-slate-300">No custom records added</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
