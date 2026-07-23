import React, { useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { toast } from 'react-toastify';
import Loading from './Loading';
import { getFormData } from '../utils/common';
import { updateCatgory } from '../api/routes/categorie';

function EditDoc({ isOpen, onClose, onSaveSuccess }) {
  const [folderData, setFolderData] = useState({ label: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFolderData({
      ...folderData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await updateCatgory(folderData);
      if (response.status === 200) {
        const data = await response.json();
        onSaveSuccess(data);
        onClose();
        setLoading(false);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du document:', error);
      toast.error("Une erreur est survenue lors de la mise à jour du document");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return loading ? <Loading /> : (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="modal-overlay absolute inset-0 bg-gray-500 opacity-75"></div>
      <div className="modal w-3/4 bg-white rounded-lg shadow-lg z-50">
        <div className="modal-box">
          <form method="dialog" className="flex justify-end">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              <IoClose />
            </button>
          </form>
          <div className="py-4">
            <h2 className="font-bold text-lg">Modifier Dossier</h2>
            <form onSubmit={handleSubmit} method="post">
              <div className="form-control mb-3">
                <label htmlFor="name" className="mb-1">Nom du dossier</label>
                <input
                  type="text"
                  id="name"
                  name="label"
                  value={folderData.label}
                  onChange={handleChange}
                  placeholder="Informatique"
                  className="input input-bordered w-full"
                  required
                />
              </div>
              <div className="modal-action flex justify-end">
                <button type="button" className="btn" onClick={onClose}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Modifier
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditDoc;
