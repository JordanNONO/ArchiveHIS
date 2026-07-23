import React from 'react';
import { Link } from 'react-router-dom';

const Breadcrumbs = ({where}) => (
  <div className="breadcrumbs text-sm">
    <ul>
      <li><Link to="/">Sige Archive</Link></li>
      <li>{where}</li>
    </ul>
  </div>
);

export default Breadcrumbs;
