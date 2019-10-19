/**
 *It is created only for testing purpose, it will be remove in future.
 * @type {{getUser: function(): {id: string, account_id: string, email: string, first_name: string, middle_name: string, language_culture_code: string, status: string, post_reg_complete: boolean, tos_status: boolean, email_status: boolean}}}
 */

var mockUser = {

    getUser: function () {
        return {
            'id': '8ed27f76-2e78-4855-b4c9-c78b94c9ab73',
            'account_id': 'feb00935-8abe-40a1-b5e2-d02baa5e2567',
            'email': 'siddharth.gosai@gmail.com',
            'first_name': 'siddharth',
            'middle_name': '',
            'language_culture_code': 'en-US',
            'status': 'active',
            'post_reg_complete': false,
            'tos_status': false,
            'email_status': false
        };
    }

};
module.exports = mockUser;
