import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';

const DocxReader = ({ fileUrl }) => {
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch(fileUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          mammoth.convertToHtml({ arrayBuffer: e.target.result })
            .then((result) => setContent(result.value))
            .catch((err) => console.error(err));
        };
        reader.readAsArrayBuffer(blob);
      })
      .catch((err) => console.error(err));
  }, [fileUrl]);

  return <div>
    <div className='max-h-[80vh] overflow-auto p-2 rounded-lg' dangerouslySetInnerHTML={{ __html: content }} />
  </div>;
};

export default DocxReader;
