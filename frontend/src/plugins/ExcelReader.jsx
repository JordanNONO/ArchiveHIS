import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const ExcelReader = ({ fileUrl }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(fileUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
          setData(worksheet);
        };
        reader.readAsBinaryString(blob);
      })
      .catch((err) => console.error(err));
  }, [fileUrl]);

  return (
    <table>
      <thead>
        <tr>
          {data.length > 0 && Object.keys(data[0]).map((key) => (
            <th key={key}>{key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {Object.values(row).map((value, i) => (
              <td key={i}>{value}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ExcelReader;
