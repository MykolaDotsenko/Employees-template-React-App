import { Component } from'react';

import './employees-add-form.css';

class EmployeesAddForm extends Component {
constructor(props){
    super(props);
    this.state = {
        name: '',
        salary: ''
    }
}


onValuechange = (e) => {
    this.setState({
        [e.target.name]: e.target.value
    })
}




render(){

    const {name, salary} = this.state;

    return (
        <div className="app-add-form">
            <h3>Add new employees</h3>
            <form
                className="add-form d-flex">
                <input type="text"
                    className="form-control new-post-label"
                
                    placeholder="What is his name?"
                    name='name'
                   value={name}
                   onChange={this.onValuechange} />                 
                <input type="number"
                    className="form-control new-post-label"
                    placeholder="Salary in $?"
                    name='salary'
                    value={salary}
                    onChange={this.onValuechange} />

                <button type="submit"
                        className="btn btn-outline-light">Add</button>
            </form>
        </div>
    )
}
}

export default EmployeesAddForm;